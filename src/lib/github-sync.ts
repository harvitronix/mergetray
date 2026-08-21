import { getDatabase, id, integer, setSetting, setting } from "./database.ts";
import { GithubClient } from "./github-client.ts";
import {
  approvedReviewers,
  type GitHubCommit,
  type GitHubPullRequest,
  type GitHubReview,
  type GitHubTimelineEvent,
  prState,
  timelineItems,
  timestamp,
} from "./github-sync-reducers.ts";

type SqlRow = Record<string, string | number | bigint | null>;

export type GithubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  archived: boolean;
  owner: { login: string };
};

type GithubUser = { id: number; login: string };

const failureConclusions = new Set([
  "ACTION_REQUIRED",
  "CANCELLED",
  "FAILURE",
  "STALE",
  "TIMED_OUT",
]);
const hydrationConcurrency = 4;
const githubIdentityRefreshIntervalMs = 60 * 60_000;
const githubIdentityRefreshedAtSetting = "github_identity_refreshed_at";

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : "Unknown error").split(
    "\n",
  )[0];
}

function transaction<T>(callback: () => T) {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function upsertSelectedRepository(repo: GithubRepository) {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO repositories(
      github_repo_id, owner, name, full_name, private, archived, selected, removed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL)
    ON CONFLICT(github_repo_id) DO UPDATE SET
      owner = excluded.owner, name = excluded.name, full_name = excluded.full_name,
      private = excluded.private, archived = excluded.archived,
      selected = 1, removed_at = NULL`,
  ).run(
    repo.id,
    repo.owner.login,
    repo.name,
    repo.full_name,
    Number(repo.private),
    Number(repo.archived),
  );
  const row = db
    .prepare("SELECT id FROM repositories WHERE github_repo_id = ?")
    .get(repo.id) as { id: number | bigint };
  return id(row.id);
}

export async function addGithubRepository(
  fullName: string,
  client?: GithubClient,
) {
  client ??= await GithubClient.create();
  const repo = await client.get<GithubRepository>(
    `/repos/${encodeURI(fullName)}`,
  );
  return upsertSelectedRepository(repo);
}

export function removeGithubRepositories(fullNames: string[]) {
  if (!fullNames.length) return;
  const placeholders = fullNames.map(() => "?").join(", ");
  getDatabase()
    .prepare(
      `UPDATE repositories SET selected = 0, removed_at = ?
       WHERE selected = 1 AND full_name IN (${placeholders})`,
    )
    .run(Date.now(), ...fullNames);
}

export async function refreshGithubIdentity(client?: GithubClient) {
  client ??= await GithubClient.create();
  const viewer = await client.get<GithubUser>("/user");
  setSetting("github_login", viewer.login);
  setSetting("github_user_id", String(viewer.id));

  const teams = await cachedPages<{
    slug: string;
    organization: { login: string };
  }>(client, "viewer-teams", "/user/teams");
  setSetting(
    "github_teams",
    JSON.stringify(
      teams.map((team) =>
        `${team.organization.login}/${team.slug}`.toLowerCase(),
      ),
    ),
  );
  setSetting(githubIdentityRefreshedAtSetting, String(Date.now()));
  return viewer;
}

function githubIdentityRefreshNeeded() {
  const refreshedAt = setting(githubIdentityRefreshedAtSetting);
  return (
    !refreshedAt ||
    Date.now() - Number(refreshedAt) >= githubIdentityRefreshIntervalMs
  );
}

type CacheRow = {
  etag: string | null;
  body: string;
  has_next: number;
};

async function cachedPage<T>(
  client: GithubClient,
  cacheKey: string,
  path: string,
) {
  const db = getDatabase();
  const cached = db
    .prepare(
      "SELECT etag, body, has_next FROM github_http_cache WHERE cache_key = ?",
    )
    .get(cacheKey) as CacheRow | undefined;
  const response = await client.rest<T>(path, cached?.etag ?? undefined);
  if (response.notModified && cached) {
    return {
      data: JSON.parse(cached.body) as T,
      hasNext: Boolean(cached.has_next),
    };
  }
  if (!response.data) throw new Error(`GitHub returned no data for ${path}.`);
  db.prepare(
    `INSERT INTO github_http_cache(cache_key, etag, body, has_next, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET etag = excluded.etag,
       body = excluded.body, has_next = excluded.has_next, updated_at = excluded.updated_at`,
  ).run(
    cacheKey,
    response.etag ?? null,
    JSON.stringify(response.data),
    Number(response.hasNext),
    Date.now(),
  );
  return { data: response.data, hasNext: response.hasNext };
}

async function cachedPages<T>(client: GithubClient, key: string, path: string) {
  const rows: T[] = [];
  for (let page = 1; page <= 1_000; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await cachedPage<T[]>(
      client,
      `${key}:page:${page}`,
      `${path}${separator}per_page=100&page=${page}`,
    );
    rows.push(...result.data);
    if (!result.hasNext) return rows;
  }
  throw new Error(`GitHub pagination exceeded 1,000 pages for ${path}.`);
}

function storedItem(repositoryId: string, number: number) {
  return getDatabase()
    .prepare(
      `SELECT i.*, d.head_sha FROM inbox_items i
       LEFT JOIN pull_request_details d ON d.inbox_item_id = i.id
       WHERE i.repository_id = ? AND i.number = ?`,
    )
    .get(repositoryId, number) as SqlRow | undefined;
}

function reactivate(inboxItemId: string, activityAt: number) {
  getDatabase()
    .prepare(
      `UPDATE user_inbox_item_states
       SET status = 'active', snoozed_until = NULL
       WHERE inbox_item_id = ? AND status = 'done'
         AND (marked_done_at IS NULL OR marked_done_at < ?)`,
    )
    .run(inboxItemId, activityAt);
}

function replaceParticipants(
  inboxItemId: string,
  participants: Array<{
    githubUserId?: string;
    githubLogin: string;
    githubOrgLogin?: string;
    githubTeamSlug?: string;
    relationship: string;
  }>,
) {
  const db = getDatabase();
  db.prepare("DELETE FROM inbox_item_participants WHERE inbox_item_id = ?").run(
    inboxItemId,
  );
  const insert = db.prepare(
    `INSERT INTO inbox_item_participants(
      inbox_item_id, github_user_id, github_login, github_org_login,
      github_team_slug, relationship
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const entry of participants) {
    insert.run(
      inboxItemId,
      entry.githubUserId ?? null,
      entry.githubLogin,
      entry.githubOrgLogin ?? null,
      entry.githubTeamSlug ?? null,
      entry.relationship,
    );
  }
}

function replaceTimeline(
  inboxItemId: string,
  entries: ReturnType<typeof timelineItems>,
) {
  const db = getDatabase();
  db.prepare("DELETE FROM inbox_item_timeline WHERE inbox_item_id = ?").run(
    inboxItemId,
  );
  const insert = db.prepare(
    `INSERT INTO inbox_item_timeline(
      inbox_item_id, kind, occurred_at, actor_login, actor_github_user_id,
      sort_order, count
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const entry of entries) {
    insert.run(
      inboxItemId,
      entry.kind,
      entry.occurredAt,
      entry.actorLogin ?? null,
      entry.actorGithubUserId ?? null,
      entry.order ?? null,
      entry.count ?? null,
    );
  }
}

async function hydratePullRequest(
  client: GithubClient,
  repository: GithubRepository,
  repositoryId: string,
  number: number,
) {
  const root = `/repos/${repository.owner.login}/${repository.name}`;
  const [details, commits, timeline] = await Promise.all([
    client.get<GitHubPullRequest>(`${root}/pulls/${number}`),
    cachedPages<GitHubCommit>(
      client,
      `commits:${repository.id}:${number}`,
      `${root}/pulls/${number}/commits`,
    ),
    cachedPages<GitHubTimelineEvent>(
      client,
      `timeline:${repository.id}:${number}`,
      `${root}/issues/${number}/timeline`,
    ),
  ]);
  const live = details;
  const now = Date.now();
  const inboxItemId = transaction(() => {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO inbox_items(
        repository_id, github_item_id, github_node_id, number, title, url,
        author_github_user_id, author_login, state, updated_at, closed_at, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repository_id, number) DO UPDATE SET
        github_item_id = excluded.github_item_id, github_node_id = excluded.github_node_id,
        title = excluded.title, url = excluded.url,
        author_github_user_id = excluded.author_github_user_id,
        author_login = excluded.author_login, state = excluded.state,
        updated_at = excluded.updated_at, closed_at = excluded.closed_at,
        last_synced_at = excluded.last_synced_at`,
    ).run(
      repositoryId,
      live.id,
      live.node_id,
      live.number,
      live.title,
      live.html_url,
      live.user?.id ? String(live.user.id) : null,
      live.user?.login ?? "unknown",
      prState(live),
      Date.parse(live.updated_at),
      timestamp(live.closed_at) ?? null,
      now,
    );
    const row = db
      .prepare(
        "SELECT id FROM inbox_items WHERE repository_id = ? AND number = ?",
      )
      .get(repositoryId, live.number) as { id: number | bigint };
    const itemId = id(row.id);
    db.prepare(
      `INSERT INTO pull_request_details(
        inbox_item_id, draft, additions, deletions, changed_files,
        head_sha, head_ref, base_ref, merged_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(inbox_item_id) DO UPDATE SET
        draft = excluded.draft, additions = excluded.additions,
        deletions = excluded.deletions, changed_files = excluded.changed_files,
        head_sha = excluded.head_sha, head_ref = excluded.head_ref,
        base_ref = excluded.base_ref, merged_at = excluded.merged_at`,
    ).run(
      itemId,
      Number(Boolean(live.draft)),
      live.additions ?? null,
      live.deletions ?? null,
      live.changed_files ?? null,
      live.head.sha,
      live.head.ref,
      live.base.ref,
      timestamp(live.merged_at) ?? null,
    );
    replaceTimeline(itemId, timelineItems(live, [], commits, timeline));
    return itemId;
  });
  reactivate(inboxItemId, Date.parse(live.updated_at));
  return inboxItemId;
}

type VolatilePullRequest = {
  id: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  updatedAt: string;
  closedAt?: string | null;
  mergedAt?: string | null;
  headRefOid: string;
  autoMergeRequest?: { enabledAt: string } | null;
  reviewRequests: {
    nodes: Array<{
      requestedReviewer?:
        | { login: string; databaseId?: number }
        | { slug: string; name: string; organization: { login: string } };
    }>;
  };
  reviews: {
    nodes: Array<{
      state: string;
      submittedAt?: string | null;
      author?: { __typename: string; login: string; databaseId?: number };
    }>;
  };
  statusCheckRollup?: {
    state: string;
    contexts: {
      nodes: Array<{
        status?: string;
        conclusion?: string | null;
        state?: string;
      }>;
    };
  } | null;
};

async function refreshVolatilePullRequests(
  client: GithubClient,
  inboxItemId?: string,
) {
  const db = getDatabase();
  const open = db
    .prepare(
      `SELECT i.id, i.github_node_id, i.repository_id, i.updated_at,
              d.head_sha, d.auto_merge_enabled, r.owner, r.name
       FROM inbox_items i
       JOIN pull_request_details d ON d.inbox_item_id = i.id
       JOIN repositories r ON r.id = i.repository_id
       WHERE i.state = 'open' AND r.selected = 1
         ${inboxItemId ? "AND i.id = ?" : ""}`,
    )
    .all(...(inboxItemId ? [inboxItemId] : [])) as SqlRow[];

  for (let offset = 0; offset < open.length; offset += 20) {
    const batch = open.slice(offset, offset + 20);
    const variables = Object.fromEntries(
      batch.map((row, index) => [`id${index}`, row.github_node_id]),
    );
    const declarations = batch.map((_, index) => `$id${index}: ID!`).join(", ");
    const selections = batch
      .map(
        (_, index) => `p${index}: node(id: $id${index}) {
          ... on PullRequest {
            id state updatedAt closedAt mergedAt headRefOid
            autoMergeRequest { enabledAt }
            reviewRequests(first: 100) {
              nodes { requestedReviewer {
                ... on User { login databaseId }
                ... on Team { slug name organization { login } }
              } }
            }
            reviews(first: 100, states: [APPROVED, CHANGES_REQUESTED]) {
              nodes { state submittedAt author { __typename login ... on User { databaseId } } }
            }
            statusCheckRollup { state contexts(first: 100) {
              nodes {
                ... on CheckRun { status conclusion }
                ... on StatusContext { state }
              }
            } }
          }
        }`,
      )
      .join("\n");
    const data = await client.graphql<
      Record<string, VolatilePullRequest | null>
    >(
      `query VolatilePullRequests(${declarations}) { ${selections} }`,
      variables,
    );

    batch.forEach((stored, index) => {
      const live = data[`p${index}`];
      if (!live) return;
      const inboxItemId = id(stored.id as number);

      const reviews = live.reviews.nodes.map((entry) => ({
        state: entry.state,
        submitted_at: entry.submittedAt ?? null,
        user: entry.author
          ? {
              id: entry.author.databaseId,
              login: entry.author.login,
              type: entry.author.__typename,
            }
          : null,
      })) as GitHubReview[];
      const requested: Array<{
        githubUserId?: string;
        githubLogin: string;
        githubOrgLogin?: string;
        githubTeamSlug?: string;
      }> = [];
      for (const entry of live.reviewRequests.nodes) {
        const reviewer = entry.requestedReviewer;
        if (!reviewer) continue;
        if ("login" in reviewer) {
          requested.push({
            githubUserId: reviewer.databaseId
              ? String(reviewer.databaseId)
              : undefined,
            githubLogin: reviewer.login,
          });
          continue;
        }
        requested.push({
          githubLogin: `${reviewer.organization.login}/${reviewer.slug}`,
          githubOrgLogin: reviewer.organization.login,
          githubTeamSlug: reviewer.slug,
        });
      }
      replaceParticipants(inboxItemId, [
        ...approvedReviewers(reviews).map((entry) => ({
          ...entry,
          relationship: "approved",
        })),
        ...requested.map((entry) => ({
          ...entry,
          relationship: "review_requested",
        })),
      ]);

      const contexts = live.statusCheckRollup?.contexts.nodes ?? [];
      let failingCount = 0;
      let pendingCount = 0;
      let passingCount = 0;
      for (const context of contexts) {
        if (context.status) {
          if (context.status !== "COMPLETED" || !context.conclusion)
            pendingCount += 1;
          else if (failureConclusions.has(context.conclusion))
            failingCount += 1;
          else passingCount += 1;
        } else if (
          context.state === "PENDING" ||
          context.state === "EXPECTED"
        ) {
          pendingCount += 1;
        } else if (context.state === "SUCCESS") passingCount += 1;
        else failingCount += 1;
      }
      const previous = db
        .prepare("SELECT * FROM pull_request_statuses WHERE inbox_item_id = ?")
        .get(inboxItemId) as SqlRow | undefined;
      const rollupState =
        live.statusCheckRollup?.state.toLowerCase() ?? "unknown";
      const autoMergeEnabled = Boolean(live.autoMergeRequest);
      const autoMergeChanged =
        Boolean(stored.auto_merge_enabled) !== autoMergeEnabled;
      const statusChanged =
        !previous ||
        String(previous.rollup_state) !== rollupState ||
        integer(previous.failing_count as number) !== failingCount ||
        integer(previous.pending_count as number) !== pendingCount ||
        integer(previous.passing_count as number) !== passingCount ||
        String(previous.head_sha) !== live.headRefOid;
      if (statusChanged) {
        db.prepare(
          `INSERT INTO pull_request_statuses(
            inbox_item_id, head_sha, rollup_state, failing_count,
            pending_count, passing_count, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(inbox_item_id) DO UPDATE SET
            head_sha = excluded.head_sha, rollup_state = excluded.rollup_state,
            failing_count = excluded.failing_count, pending_count = excluded.pending_count,
            passing_count = excluded.passing_count, updated_at = excluded.updated_at`,
        ).run(
          inboxItemId,
          live.headRefOid,
          rollupState,
          failingCount,
          pendingCount,
          passingCount,
          Date.now(),
        );
      }
      const updatedAt = Date.parse(live.updatedAt);
      if (
        updatedAt > Number(stored.updated_at) ||
        statusChanged ||
        autoMergeChanged
      ) {
        db.prepare(
          `UPDATE inbox_items
           SET state = ?, updated_at = ?, closed_at = ?, last_synced_at = ?
           WHERE id = ?`,
        ).run(
          live.state.toLowerCase(),
          updatedAt,
          timestamp(live.closedAt) ?? timestamp(live.mergedAt) ?? null,
          Date.now(),
          inboxItemId,
        );
        db.prepare(
          `UPDATE pull_request_details
           SET merged_at = ?, auto_merge_enabled = ?
           WHERE inbox_item_id = ?`,
        ).run(
          timestamp(live.mergedAt) ?? null,
          Number(autoMergeEnabled),
          inboxItemId,
        );
        reactivate(inboxItemId, Date.now());
      }
    });
  }
}

async function syncRepository(client: GithubClient, row: SqlRow) {
  const repository: GithubRepository = {
    id: integer(row.github_repo_id as number),
    owner: { login: String(row.owner) },
    name: String(row.name),
    full_name: String(row.full_name),
    private: Boolean(row.private),
    archived: Boolean(row.archived),
  };
  const repositoryId = id(row.id as number);
  const root = `/repos/${repository.owner.login}/${repository.name}`;
  const pulls = await cachedPages<GitHubPullRequest>(
    client,
    `open-pulls:${repository.id}`,
    `${root}/pulls?state=open&sort=created&direction=desc`,
  );
  const changedPulls = pulls.filter((pull) => {
    const stored = storedItem(repositoryId, pull.number);
    return (
      !stored ||
      Number(stored.updated_at) !== Date.parse(pull.updated_at) ||
      stored.head_sha !== pull.head.sha
    );
  });
  for (
    let offset = 0;
    offset < changedPulls.length;
    offset += hydrationConcurrency
  ) {
    await Promise.all(
      changedPulls
        .slice(offset, offset + hydrationConcurrency)
        .map((pull) =>
          hydratePullRequest(client, repository, repositoryId, pull.number),
        ),
    );
  }

  return pulls.length;
}

export type GithubSyncTarget = {
  repository: string;
  number: number;
};

export async function syncGithubItem(target: GithubSyncTarget) {
  const row = getDatabase()
    .prepare(
      `SELECT * FROM repositories
       WHERE full_name = ? AND selected = 1 AND removed_at IS NULL`,
    )
    .get(target.repository) as SqlRow | undefined;
  if (!row) return false;

  const repository: GithubRepository = {
    id: integer(row.github_repo_id as number),
    owner: { login: String(row.owner) },
    name: String(row.name),
    full_name: String(row.full_name),
    private: Boolean(row.private),
    archived: Boolean(row.archived),
  };
  const repositoryId = id(row.id as number);

  const client = await GithubClient.create();
  const inboxItemId = await hydratePullRequest(
    client,
    repository,
    repositoryId,
    target.number,
  );
  await refreshVolatilePullRequests(client, inboxItemId);
  return true;
}

export function githubDataRevision() {
  const row = getDatabase()
    .prepare(
      "SELECT COALESCE(MAX(last_synced_at), 0) AS revision FROM inbox_items",
    )
    .get() as { revision: number };
  return row.revision;
}

let runningSync:
  | Promise<{ repositoryCount: number; pullRequestCount: number }>
  | undefined;

export function githubSyncNeeded() {
  if (runningSync) return true;
  const state = getDatabase()
    .prepare(
      "SELECT last_completed_at, failed_at FROM sync_state WHERE source = 'github'",
    )
    .get() as { last_completed_at?: number; failed_at?: number } | undefined;
  if (
    state?.last_completed_at &&
    Date.now() - state.last_completed_at < 5 * 60_000
  )
    return false;
  return !(state?.failed_at && Date.now() - state.failed_at < 60_000);
}

export async function syncGithub(force = false) {
  if (runningSync) return await runningSync;
  if (!force && !githubSyncNeeded()) {
    return { repositoryCount: 0, pullRequestCount: 0 };
  }
  const db = getDatabase();

  runningSync = (async () => {
    db.prepare(
      `INSERT INTO sync_state(source, last_started_at, error)
       VALUES ('github', ?, NULL)
       ON CONFLICT(source) DO UPDATE SET last_started_at = excluded.last_started_at, error = NULL`,
    ).run(Date.now());
    try {
      const client = await GithubClient.create();
      if (githubIdentityRefreshNeeded()) await refreshGithubIdentity(client);
      const repositories = db
        .prepare(
          "SELECT * FROM repositories WHERE selected = 1 AND removed_at IS NULL ORDER BY full_name",
        )
        .all() as SqlRow[];
      let pullRequestCount = 0;
      for (const repository of repositories) {
        pullRequestCount += await syncRepository(client, repository);
      }
      await refreshVolatilePullRequests(client);
      db.prepare(
        `UPDATE sync_state SET last_completed_at = ?, failed_at = NULL, error = NULL
         WHERE source = 'github'`,
      ).run(Date.now());
      return { repositoryCount: repositories.length, pullRequestCount };
    } catch (error) {
      db.prepare(
        "UPDATE sync_state SET failed_at = ?, error = ? WHERE source = 'github'",
      ).run(Date.now(), errorMessage(error));
      throw error;
    }
  })();
  try {
    return await runningSync;
  } finally {
    runningSync = undefined;
  }
}

export function githubSyncState() {
  return getDatabase()
    .prepare("SELECT * FROM sync_state WHERE source = 'github'")
    .get() as
    | {
        last_started_at?: number;
        last_completed_at?: number;
        failed_at?: number;
        error?: string;
      }
    | undefined;
}
