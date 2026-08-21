import { cache } from "react";
import { getDatabase, id, integer, setting } from "@/lib/database";
import { inboxRuleStaleThresholdMs, isBot } from "@/lib/inbox-section-rules";
import type {
  InboxItem,
  InboxParticipant,
  InboxRow,
  InboxTimelineItem,
  PullRequestDetails,
  PullRequestStatus,
  Repository,
  UserState,
} from "@/lib/models";

type SqlRow = Record<string, string | number | bigint | null>;

function optionalNumber(value: unknown) {
  return value === null || value === undefined ? undefined : Number(value);
}

function optionalString(value: unknown) {
  return value === null || value === undefined ? undefined : String(value);
}

function repository(row: SqlRow): Repository {
  return {
    id: id(row.id as number),
    githubRepoId: integer(row.github_repo_id as number),
    owner: String(row.owner),
    name: String(row.name),
    fullName: String(row.full_name),
    private: Boolean(row.private),
    archived: Boolean(row.archived),
    removedAt: optionalNumber(row.removed_at),
  };
}

function item(row: SqlRow): InboxItem {
  return {
    id: id(row.id as number),
    repositoryId: id(row.repository_id as number),
    githubItemId: optionalNumber(row.github_item_id),
    githubNodeId: optionalString(row.github_node_id),
    number: integer(row.number as number),
    title: String(row.title),
    url: String(row.url),
    authorGithubUserId: optionalString(row.author_github_user_id),
    authorLogin: String(row.author_login),
    state: String(row.state) as InboxItem["state"],
    updatedAt: integer(row.updated_at as number),
    closedAt: optionalNumber(row.closed_at),
    lastSyncedAt: integer(row.last_synced_at as number),
  };
}

function details(row: SqlRow): PullRequestDetails {
  return {
    id: id(row.id as number),
    inboxItemId: id(row.inbox_item_id as number),
    draft: Boolean(row.draft),
    additions: optionalNumber(row.additions),
    deletions: optionalNumber(row.deletions),
    changedFiles: optionalNumber(row.changed_files),
    headSha: String(row.head_sha),
    headRef: String(row.head_ref),
    baseRef: String(row.base_ref),
    mergedAt: optionalNumber(row.merged_at),
    autoMergeEnabled: Boolean(row.auto_merge_enabled),
  };
}

function status(row: SqlRow): PullRequestStatus {
  return {
    id: id(row.id as number),
    inboxItemId: id(row.inbox_item_id as number),
    headSha: String(row.head_sha),
    rollupState: String(row.rollup_state),
    failingCount: integer(row.failing_count as number),
    pendingCount: integer(row.pending_count as number),
    passingCount: integer(row.passing_count as number),
    updatedAt: integer(row.updated_at as number),
  };
}

function userState(row: SqlRow): UserState {
  return {
    id: id(row.id as number),
    inboxItemId: id(row.inbox_item_id as number),
    status: String(row.status) as UserState["status"],
    markedDoneAt: optionalNumber(row.marked_done_at),
    snoozedUntil: optionalNumber(row.snoozed_until),
    shipItPromotedAt: optionalNumber(row.ship_it_promoted_at),
    note: optionalString(row.note),
  };
}

function participant(row: SqlRow): InboxParticipant {
  return {
    id: id(row.id as number),
    inboxItemId: id(row.inbox_item_id as number),
    githubUserId: optionalString(row.github_user_id),
    githubLogin: String(row.github_login),
    githubOrgLogin: optionalString(row.github_org_login),
    githubTeamSlug: optionalString(row.github_team_slug),
    relationship: String(row.relationship) as InboxParticipant["relationship"],
  };
}

function timelineItem(row: SqlRow): InboxTimelineItem {
  return {
    id: id(row.id as number),
    inboxItemId: id(row.inbox_item_id as number),
    kind: String(row.kind) as InboxTimelineItem["kind"],
    occurredAt: integer(row.occurred_at as number),
    actorLogin: optionalString(row.actor_login),
    actorGithubUserId: optionalString(row.actor_github_user_id),
    order: optionalNumber(row.sort_order),
    count: optionalNumber(row.count),
  };
}

function rowsById(rows: SqlRow[]) {
  return new Map(rows.map((row) => [id(row.id as number), row]));
}

function rowsByInboxItem<T>(rows: SqlRow[], convert: (row: SqlRow) => T) {
  return new Map(
    rows.map((row) => [id(row.inbox_item_id as number), convert(row)]),
  );
}

function groupedByInboxItem<T>(rows: SqlRow[], convert: (row: SqlRow) => T) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const inboxItemId = id(row.inbox_item_id as number);
    const entries = grouped.get(inboxItemId) ?? [];
    entries.push(convert(row));
    grouped.set(inboxItemId, entries);
  }
  return grouped;
}

function sameViewer(
  viewerId: string | undefined,
  viewerLogin: string | undefined,
  githubId: string | undefined,
  login: string | undefined,
) {
  return (
    (viewerId !== undefined && viewerId === githubId) ||
    (viewerLogin !== undefined &&
      viewerLogin.toLowerCase() === login?.toLowerCase())
  );
}

function priorityReason(
  timeline: InboxTimelineItem[],
  viewerId: string | undefined,
  viewerLogin: string | undefined,
) {
  const viewerReviews = timeline.filter(
    (entry) =>
      (entry.kind === "approved" || entry.kind === "changes_requested") &&
      sameViewer(
        viewerId,
        viewerLogin,
        entry.actorGithubUserId,
        entry.actorLogin,
      ),
  );
  const latest = viewerReviews.at(-1);
  const position = latest?.order ?? latest?.occurredAt;
  if (
    latest?.kind === "changes_requested" &&
    position !== undefined &&
    timeline.some(
      (entry) =>
        entry.kind === "commits" &&
        (entry.order ?? entry.occurredAt) > position,
    )
  ) {
    return "changes_after_your_review" as const;
  }

  const openedAt = timeline.find(
    (entry) => entry.kind === "opened",
  )?.occurredAt;
  const humanReview = timeline.some(
    (entry) =>
      (entry.kind === "approved" || entry.kind === "changes_requested") &&
      !isBot(entry.actorLogin),
  );
  if (
    openedAt &&
    Date.now() - openedAt >= inboxRuleStaleThresholdMs &&
    !humanReview
  ) {
    return "stale_without_human_review" as const;
  }
}

function wakeExpiredSnoozes() {
  getDatabase()
    .prepare(
      "UPDATE user_inbox_item_states SET status = 'active', snoozed_until = NULL WHERE status = 'done' AND snoozed_until IS NOT NULL AND snoozed_until <= ?",
    )
    .run(Date.now());
}

export function listRepositories() {
  return (
    getDatabase()
      .prepare(
        "SELECT * FROM repositories WHERE selected = 1 AND removed_at IS NULL ORDER BY full_name",
      )
      .all() as SqlRow[]
  ).map(repository);
}

function loadInboxRows(repositoryId?: string): InboxRow[] {
  wakeExpiredSnoozes();
  const db = getDatabase();
  const viewerId = setting("github_user_id");
  const viewerLogin = setting("github_login");
  const viewerTeams = new Set(
    JSON.parse(setting("github_teams") ?? "[]") as string[],
  );
  const rows = db
    .prepare(
      `SELECT * FROM inbox_items
       WHERE state = 'open' AND (? IS NULL OR repository_id = ?)
       ORDER BY updated_at DESC`,
    )
    .all(repositoryId ?? null, repositoryId ?? null) as SqlRow[];
  const repositories = rowsById(
    db.prepare("SELECT * FROM repositories").all() as SqlRow[],
  );
  const pullRequestDetails = rowsByInboxItem(
    db.prepare("SELECT * FROM pull_request_details").all() as SqlRow[],
    details,
  );
  const pullRequestStatuses = rowsByInboxItem(
    db.prepare("SELECT * FROM pull_request_statuses").all() as SqlRow[],
    status,
  );
  const userStates = rowsByInboxItem(
    db.prepare("SELECT * FROM user_inbox_item_states").all() as SqlRow[],
    userState,
  );
  const participantsByItem = groupedByInboxItem(
    db.prepare("SELECT * FROM inbox_item_participants").all() as SqlRow[],
    participant,
  );
  const timelineByItem = groupedByInboxItem(
    db
      .prepare(
        "SELECT * FROM inbox_item_timeline ORDER BY COALESCE(sort_order, occurred_at)",
      )
      .all() as SqlRow[],
    timelineItem,
  );

  return rows.flatMap((rawItem) => {
    const inboxItem = item(rawItem);
    const rawRepository = repositories.get(inboxItem.repositoryId);

    const rawDetails = pullRequestDetails.get(inboxItem.id);
    if (!rawRepository?.selected || !rawDetails) return [];
    const rawStatus = pullRequestStatuses.get(inboxItem.id);
    const rawUserState = userStates.get(inboxItem.id);
    const participants = participantsByItem.get(inboxItem.id) ?? [];
    const timeline = timelineByItem.get(inboxItem.id) ?? [];
    const matchesParticipant = (relationship: string) =>
      participants.some(
        (entry) =>
          entry.relationship === relationship &&
          sameViewer(
            viewerId,
            viewerLogin,
            entry.githubUserId,
            entry.githubLogin,
          ),
      );
    const reviewRequested =
      matchesParticipant("review_requested") ||
      participants.some(
        (entry) =>
          entry.relationship === "review_requested" &&
          entry.githubOrgLogin &&
          entry.githubTeamSlug &&
          viewerTeams.has(
            `${entry.githubOrgLogin}/${entry.githubTeamSlug}`.toLowerCase(),
          ),
      );
    const authored = sameViewer(
      viewerId,
      viewerLogin,
      inboxItem.authorGithubUserId,
      inboxItem.authorLogin,
    );
    return [
      {
        item: inboxItem,
        repository: repository(rawRepository),
        pullRequestDetails: rawDetails,
        status: rawStatus ?? null,
        userState: rawUserState ?? null,
        isAuthoredByViewer: authored,
        isRelevantToViewer:
          authored || matchesParticipant("approved") || reviewRequested,
        isApprovedByViewer: matchesParticipant("approved"),
        isReviewRequestedFromViewer: reviewRequested,
        approvals: participants.filter(
          (entry) => entry.relationship === "approved",
        ),
        timeline,
        agentSessionLinks: [],
        agentSessionCandidates: [],
        priorityReason:
          !rawDetails.draft &&
          (rawDetails.baseRef === "main" || rawDetails.baseRef === "master")
            ? priorityReason(timeline, viewerId, viewerLogin)
            : undefined,
      },
    ];
  });
}

export const listInboxRows = cache(loadInboxRows);

export function inboxCounts(rows = listInboxRows()) {
  const repositories = new Map<string, number>();
  let all = 0;
  for (const row of rows) {
    if (row.userState?.status === "done") continue;
    all += 1;
    if (row.item.repositoryId) {
      repositories.set(
        row.item.repositoryId,
        (repositories.get(row.item.repositoryId) ?? 0) + 1,
      );
    }
  }
  return {
    all,
    repositories: Array.from(repositories, ([repositoryId, active]) => ({
      repositoryId,
      active,
    })),
  };
}

export function recentlyMerged(repositoryId?: string) {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM inbox_items
       WHERE state = 'merged' AND (? IS NULL OR repository_id = ?)
       ORDER BY closed_at DESC LIMIT 25`,
    )
    .all(repositoryId ?? null, repositoryId ?? null) as SqlRow[];
  return rows.flatMap((raw) => {
    const inboxItem = item(raw);
    if (!inboxItem.repositoryId) return [];
    const rawRepository = db
      .prepare("SELECT * FROM repositories WHERE id = ? AND selected = 1")
      .get(inboxItem.repositoryId) as SqlRow | undefined;
    const rawDetails = db
      .prepare("SELECT * FROM pull_request_details WHERE inbox_item_id = ?")
      .get(inboxItem.id) as SqlRow | undefined;
    return rawRepository && rawDetails
      ? [
          {
            item: inboxItem,
            repository: repository(rawRepository),
            pullRequestDetails: details(rawDetails),
          },
        ]
      : [];
  });
}

function requireInboxItem(inboxItemId: string) {
  const row = getDatabase()
    .prepare("SELECT id FROM inbox_items WHERE id = ?")
    .get(inboxItemId) as { id: number } | undefined;
  if (!row) throw new Error("Inbox item not found.");
  return row;
}

function ensureUserState(inboxItemId: string) {
  const db = getDatabase();
  db.prepare(
    "INSERT INTO user_inbox_item_states(inbox_item_id, status) VALUES (?, 'active') ON CONFLICT(inbox_item_id) DO NOTHING",
  ).run(inboxItemId);
}

export function setUserStatus(
  inboxItemId: string,
  nextStatus: "active" | "done",
) {
  requireInboxItem(inboxItemId);
  ensureUserState(inboxItemId);
  getDatabase()
    .prepare(
      "UPDATE user_inbox_item_states SET status = ?, marked_done_at = ?, snoozed_until = NULL WHERE inbox_item_id = ?",
    )
    .run(nextStatus, nextStatus === "done" ? Date.now() : null, inboxItemId);
}

export function setShipItPromotion(inboxItemId: string, promoted: boolean) {
  requireInboxItem(inboxItemId);
  ensureUserState(inboxItemId);
  getDatabase()
    .prepare(
      "UPDATE user_inbox_item_states SET ship_it_promoted_at = ? WHERE inbox_item_id = ?",
    )
    .run(promoted ? Date.now() : null, inboxItemId);
}

export function setUserNote(inboxItemId: string, note?: string) {
  requireInboxItem(inboxItemId);
  ensureUserState(inboxItemId);
  getDatabase()
    .prepare(
      "UPDATE user_inbox_item_states SET note = ? WHERE inbox_item_id = ?",
    )
    .run(note?.trim().slice(0, 160) || null, inboxItemId);
}

export function snoozeInboxItem(
  inboxItemId: string,
  duration: "1h" | "3h" | "tomorrow" | "nextWeek",
  suppliedUntil?: number,
) {
  requireInboxItem(inboxItemId);
  const now = Date.now();
  const snoozedUntil =
    duration === "1h"
      ? now + 60 * 60 * 1_000
      : duration === "3h"
        ? now + 3 * 60 * 60 * 1_000
        : suppliedUntil;
  const max = duration === "nextWeek" ? 8 * 86_400_000 : 2 * 86_400_000;
  if (!snoozedUntil || snoozedUntil <= now || snoozedUntil > now + max) {
    throw new Error("Invalid snooze time.");
  }
  ensureUserState(inboxItemId);
  getDatabase()
    .prepare(
      "UPDATE user_inbox_item_states SET status = 'done', marked_done_at = ?, snoozed_until = ? WHERE inbox_item_id = ?",
    )
    .run(now, snoozedUntil, inboxItemId);
}

export function githubIdentityConfigured() {
  return Boolean(setting("github_login") || setting("github_user_id"));
}
