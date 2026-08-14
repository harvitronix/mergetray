import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { codexIntegrationEnabled } from "./codex-integration";
import {
  codexSessionMatches,
  githubRepository,
  singleActiveCodexSession,
} from "./codex-links";
import { getDatabase } from "./database";
import { GithubClient } from "./github-client";
import type {
  AgentSession,
  AgentSessionLink,
  AgentSessionLookup,
  AgentSessionProvider,
  InboxRow,
} from "./models";

type CodexThread = {
  id: string;
  parentThreadId: string | null;
  preview: string;
  cwd: string;
  updatedAt: number;
  name: string | null;
  gitInfo: {
    branch: string | null;
    originUrl: string | null;
  } | null;
};

type ThreadListResult = {
  data: CodexThread[];
  nextCursor: string | null;
};

type CodexSession = AgentSession & {
  branch: string;
  originUrl: string;
  githubRepoId?: number;
};

type AgentSessionContext = {
  inbox_item_id: number;
  github_repo_id: number;
  full_name: string;
  head_ref: string;
};

type CodexSessionScan = {
  sessions: CodexSession[];
  error?: string;
};

const codexSessionCacheDurationMs = 30_000;
const githubRepositoryIdCache = new Map<string, number>();
let codexSessionCache:
  | { expiresAt: number; result: CodexSessionScan }
  | undefined;
let codexSessionRequest: Promise<CodexSessionScan> | undefined;

function sessionTitle(thread: CodexThread) {
  return thread.name ?? thread.preview.split("\n", 1)[0].slice(0, 120);
}

export function listAgentSessionLinks() {
  return (
    getDatabase().prepare("SELECT * FROM agent_session_links").all() as Array<{
      inbox_item_id: number;
      provider: AgentSessionProvider;
      session_id: string;
    }>
  ).map((row): AgentSessionLink & { inboxItemId: string } => ({
    inboxItemId: String(row.inbox_item_id),
    provider: row.provider,
    sessionId: row.session_id,
  }));
}

export function attachAgentSessionLinks(rows: InboxRow[]) {
  const links = listAgentSessionLinks();
  return rows.map((row) => ({
    ...row,
    agentSessionLinks: links
      .filter((link) => link.inboxItemId === row.item.id)
      .map(({ provider, sessionId }) => ({ provider, sessionId })),
  }));
}

export function setAgentSessionLink(
  inboxItemId: string,
  provider: AgentSessionProvider,
  sessionId: string,
) {
  const db = getDatabase();
  db.prepare(
    "DELETE FROM agent_session_auto_link_suppressions WHERE inbox_item_id = ? AND provider = ?",
  ).run(inboxItemId, provider);
  db.prepare(
    `INSERT INTO agent_session_links(inbox_item_id, provider, session_id)
       SELECT id, ?, ? FROM inbox_items WHERE id = ?
       ON CONFLICT(inbox_item_id, provider)
       DO UPDATE SET session_id = excluded.session_id`,
  ).run(provider, sessionId, inboxItemId);
}

export function unlinkAgentSession(
  inboxItemId: string,
  provider: AgentSessionProvider,
) {
  const db = getDatabase();
  db.prepare(
    "DELETE FROM agent_session_links WHERE inbox_item_id = ? AND provider = ?",
  ).run(inboxItemId, provider);
  db.prepare(
    `INSERT INTO agent_session_auto_link_suppressions(inbox_item_id, provider)
     SELECT id, ? FROM inbox_items WHERE id = ?
     ON CONFLICT DO NOTHING`,
  ).run(provider, inboxItemId);
}

export function dismissAgentSession(
  inboxItemId: string,
  provider: AgentSessionProvider,
  sessionId: string,
) {
  getDatabase()
    .prepare(
      `INSERT INTO agent_session_dismissals(inbox_item_id, provider, session_id)
       SELECT id, ?, ? FROM inbox_items WHERE id = ?
       ON CONFLICT DO NOTHING`,
    )
    .run(provider, sessionId, inboxItemId);
}

function scanCodexSessions() {
  return new Promise<CodexSessionScan>((resolve) => {
    const child = spawn("codex", ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    const lines = createInterface({ input: child.stdout });
    const threads: Array<CodexThread & { archived: boolean }> = [];
    let requestId = 2;
    let archived = false;
    let settled = false;

    function finish(result: CodexSessionScan) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      lines.close();
      child.stdin.end();
      child.kill();
      resolve(result);
    }

    function requestPage(cursor: string | null = null) {
      child.stdin.write(
        `${JSON.stringify({
          method: "thread/list",
          id: requestId++,
          params: {
            cursor,
            limit: 100,
            sortKey: "updated_at",
            sortDirection: "desc",
            archived,
            useStateDbOnly: true,
          },
        })}\n`,
      );
    }

    const timeout = setTimeout(
      () => finish({ sessions: [], error: "Codex task scan timed out." }),
      5_000,
    );
    child.on("error", () =>
      finish({
        sessions: [],
        error: "Codex CLI is not available on the server PATH.",
      }),
    );
    child.on("exit", () =>
      finish({ sessions: [], error: "Codex task scan stopped unexpectedly." }),
    );
    child.stdin.on("error", () =>
      finish({ sessions: [], error: "Codex task scan failed." }),
    );
    lines.on("line", (line) => {
      try {
        const message = JSON.parse(line) as {
          id?: number;
          result?: ThreadListResult;
          error?: unknown;
        };

        if (message.id === 1) {
          child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
          requestPage();
          return;
        }
        if (!message.id || message.id < 2) return;
        if (message.error || !message.result) {
          finish({ sessions: [], error: "Codex task scan failed." });
          return;
        }

        threads.push(
          ...message.result.data.map((thread) => ({ ...thread, archived })),
        );
        if (message.result.nextCursor) {
          requestPage(message.result.nextCursor);
        } else if (!archived) {
          archived = true;
          requestPage();
        } else {
          finish({
            sessions: threads.flatMap((thread) => {
              const branch = thread.gitInfo?.branch;
              const originUrl = thread.gitInfo?.originUrl;
              if (!branch || !originUrl || thread.parentThreadId) return [];
              return [
                {
                  provider: "codex" as const,
                  sessionId: thread.id,
                  title: sessionTitle(thread),
                  cwd: thread.cwd,
                  updatedAt: thread.updatedAt * 1_000,
                  archived: thread.archived,
                  branch,
                  originUrl,
                },
              ];
            }),
          });
        }
      } catch {
        finish({ sessions: [], error: "Codex task scan failed." });
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        method: "initialize",
        id: 1,
        params: {
          clientInfo: {
            name: "mergetray",
            title: "MergeTray",
            version: "0.1.0",
          },
          capabilities: null,
        },
      })}\n`,
    );
  });
}

function cachedCodexSessions() {
  if (codexSessionCache && codexSessionCache.expiresAt > Date.now()) {
    return Promise.resolve(codexSessionCache.result);
  }
  if (codexSessionRequest) return codexSessionRequest;

  codexSessionRequest = scanCodexSessions()
    .then((result) => {
      codexSessionCache = {
        expiresAt: Date.now() + codexSessionCacheDurationMs,
        result,
      };
      return result;
    })
    .finally(() => {
      codexSessionRequest = undefined;
    });
  return codexSessionRequest;
}

async function resolveGithubRepositoryIds(
  contexts: AgentSessionContext[],
  sessions: CodexSession[],
) {
  for (const context of contexts) {
    githubRepositoryIdCache.set(
      context.full_name.toLowerCase(),
      context.github_repo_id,
    );
  }

  const branches = new Set(contexts.map((context) => context.head_ref));
  const unresolved = new Set(
    sessions
      .filter((session) => branches.has(session.branch))
      .map((session) => githubRepository(session.originUrl))
      .filter(
        (repository): repository is string =>
          repository !== undefined && !githubRepositoryIdCache.has(repository),
      ),
  );

  if (unresolved.size) {
    try {
      const client = await GithubClient.create();
      const resolved = await Promise.all(
        [...unresolved].map(async (repository) => {
          try {
            const result = await client.get<{ id: number }>(
              `/repos/${encodeURI(repository)}`,
            );
            return [repository, result.id] as const;
          } catch {
            return undefined;
          }
        }),
      );
      for (const result of resolved) {
        if (result) githubRepositoryIdCache.set(...result);
      }
    } catch {
      // Repositories already in the inbox still match without GitHub auth.
    }
  }

  for (const session of sessions) {
    const repository = githubRepository(session.originUrl);
    session.githubRepoId = repository
      ? githubRepositoryIdCache.get(repository)
      : undefined;
  }
}

export async function codexSessionsForInboxItem(
  inboxItemId: string,
): Promise<AgentSessionLookup | undefined> {
  if (!codexIntegrationEnabled()) return undefined;

  const db = getDatabase();
  const context = db
    .prepare(
      `SELECT inbox_items.id AS inbox_item_id, repositories.github_repo_id,
              repositories.full_name, pull_request_details.head_ref
       FROM inbox_items
       JOIN repositories ON repositories.id = inbox_items.repository_id
       JOIN pull_request_details ON pull_request_details.inbox_item_id = inbox_items.id
       WHERE inbox_items.id = ? AND inbox_items.state = 'open' AND repositories.selected = 1`,
    )
    .get(inboxItemId) as AgentSessionContext | undefined;
  if (!context) return undefined;

  const { sessions, error } = await cachedCodexSessions();
  await resolveGithubRepositoryIds([context], sessions);
  const dismissed = new Set(
    (
      db
        .prepare(
          "SELECT session_id FROM agent_session_dismissals WHERE inbox_item_id = ? AND provider = 'codex'",
        )
        .all(inboxItemId) as Array<{ session_id: string }>
    ).map((row) => row.session_id),
  );
  const candidates = sessions.filter(
    (session) =>
      !dismissed.has(session.sessionId) &&
      codexSessionMatches(session, context.github_repo_id, context.head_ref),
  );
  const storedLink = listAgentSessionLinks().find(
    (link) => link.inboxItemId === inboxItemId && link.provider === "codex",
  );
  let link = storedLink
    ? { provider: storedLink.provider, sessionId: storedLink.sessionId }
    : undefined;
  let autoLinked = false;
  const suppressed = db
    .prepare(
      "SELECT 1 FROM agent_session_auto_link_suppressions WHERE inbox_item_id = ? AND provider = 'codex'",
    )
    .get(inboxItemId);
  const autoLink =
    link || suppressed ? undefined : singleActiveCodexSession(candidates);
  if (autoLink) {
    link = { provider: "codex", sessionId: autoLink.sessionId };
    setAgentSessionLink(inboxItemId, "codex", autoLink.sessionId);
    autoLinked = true;
  }

  return {
    link,
    candidates: candidates.slice(0, 5),
    error,
    autoLinked,
  };
}
