import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  type CodexThread,
  type CodexThreadItem,
  codexAppServer,
} from "./codex-app-server";
import { githubRepository } from "./codex-links";
import { getDatabase, mergetrayDatabasePath } from "./database";
import {
  type CapabilityAuditResult,
  capabilityAuditResultSchema,
  type PostDeployMonitorLink,
  parseCapabilityAuditResult,
} from "./post-deploy-result";

const execFileAsync = promisify(execFile);
const auditTimeoutMs = 35 * 60_000;

export type PostDeployRun = {
  id: string;
  inboxItemId: string;
  status: PostDeployMonitorLink["status"];
  mergeSha: string;
  threadId?: string;
  turnId?: string;
  worktreePath?: string;
  result?: CapabilityAuditResult;
  error?: string;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

type RunRow = {
  id: number;
  inbox_item_id: number;
  status: PostDeployRun["status"];
  merge_sha: string;
  thread_id: string | null;
  turn_id: string | null;
  worktree_path: string | null;
  result_json: string | null;
  error: string | null;
  attempts: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

type MonitorContext = {
  inbox_item_id: number;
  full_name: string;
  local_path: string | null;
  production_url: string | null;
  post_deploy_instructions: string | null;
  number: number;
  title: string;
  url: string;
  head_sha: string;
  head_ref: string;
  base_ref: string;
  merge_commit_sha: string | null;
  merged_at: number | null;
};

const activeRuns = new Set<string>();

function optional(value: string | null) {
  return value ?? undefined;
}

function postDeployRun(row: RunRow): PostDeployRun {
  return {
    id: String(row.id),
    inboxItemId: String(row.inbox_item_id),
    status: row.status,
    mergeSha: row.merge_sha,
    threadId: optional(row.thread_id),
    turnId: optional(row.turn_id),
    worktreePath: optional(row.worktree_path),
    result: row.result_json
      ? parseCapabilityAuditResult(row.result_json)
      : undefined,
    error: optional(row.error),
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function monitorContext(inboxItemId: string) {
  return getDatabase()
    .prepare(
      `SELECT inbox_items.id AS inbox_item_id, repositories.full_name,
              repositories.local_path, repositories.production_url,
              repositories.post_deploy_instructions, inbox_items.number,
              inbox_items.title, inbox_items.url,
              pull_request_details.head_sha, pull_request_details.head_ref,
              pull_request_details.base_ref,
              pull_request_details.merge_commit_sha,
              pull_request_details.merged_at
       FROM inbox_items
       JOIN repositories ON repositories.id = inbox_items.repository_id
       JOIN pull_request_details ON pull_request_details.inbox_item_id = inbox_items.id
       WHERE inbox_items.id = ? AND inbox_items.state = 'merged'
         AND repositories.selected = 1`,
    )
    .get(inboxItemId) as MonitorContext | undefined;
}

export function postDeployRunForInboxItem(inboxItemId: string) {
  const row = getDatabase()
    .prepare("SELECT * FROM post_deploy_runs WHERE inbox_item_id = ?")
    .get(inboxItemId) as RunRow | undefined;
  return row ? postDeployRun(row) : undefined;
}

export function postDeployRunById(runId: string) {
  const row = getDatabase()
    .prepare("SELECT * FROM post_deploy_runs WHERE id = ?")
    .get(runId) as RunRow | undefined;
  return row ? postDeployRun(row) : undefined;
}

export function postDeployTarget(inboxItemId: string) {
  return getDatabase()
    .prepare(
      `SELECT repositories.full_name AS repository, inbox_items.number
       FROM inbox_items
       JOIN repositories ON repositories.id = inbox_items.repository_id
       WHERE inbox_items.id = ? AND inbox_items.state = 'merged'`,
    )
    .get(inboxItemId) as { repository: string; number: number } | undefined;
}

export function setRepositoryPostDeploySettings(
  repositoryId: string,
  productionUrl: string,
  instructions: string,
) {
  const trimmedUrl = productionUrl.trim();
  if (trimmedUrl) {
    const url = new URL(trimmedUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Production URL must use HTTP or HTTPS.");
    }
  }
  const result = getDatabase()
    .prepare(
      `UPDATE repositories
       SET production_url = ?, post_deploy_instructions = ?
       WHERE id = ? AND selected = 1`,
    )
    .run(trimmedUrl || null, instructions.trim() || null, repositoryId);
  if (!result.changes) throw new Error("Repository not found.");
}

export function queuePostDeployCapabilityRun(inboxItemId: string) {
  const context = monitorContext(inboxItemId);
  if (!context) throw new Error("Choose a merged pull request.");
  if (!context.merge_commit_sha) {
    throw new Error(
      "GitHub has not supplied this pull request's merge commit yet.",
    );
  }
  if (!context.local_path) {
    throw new Error(`Set a local checkout for ${context.full_name} first.`);
  }

  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO post_deploy_runs(
         inbox_item_id, status, merge_sha, created_at, updated_at
       ) VALUES (?, 'queued', ?, ?, ?)
       ON CONFLICT(inbox_item_id) DO UPDATE SET
         status = 'queued', merge_sha = excluded.merge_sha,
         turn_id = NULL, result_json = NULL, error = NULL,
         updated_at = excluded.updated_at, completed_at = NULL`,
    )
    .run(inboxItemId, context.merge_commit_sha, now, now);
  const run = postDeployRunForInboxItem(inboxItemId);
  if (!run) throw new Error("Post-deploy run could not be saved.");
  return run;
}

async function git(cwd: string, ...args: string[]) {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
    timeout: 60_000,
  });
  return stdout.trim();
}

async function prepareWorktree(context: MonitorContext, mergeSha: string) {
  if (!/^[0-9a-f]{40}$/i.test(mergeSha)) {
    throw new Error("The merge commit is invalid.");
  }
  if (!context.local_path)
    throw new Error("The local checkout is unavailable.");
  const repositoryRoot = await git(
    context.local_path,
    "rev-parse",
    "--show-toplevel",
  );
  const originUrl = await git(
    repositoryRoot,
    "config",
    "--get",
    "remote.origin.url",
  );
  if (githubRepository(originUrl) !== context.full_name.toLowerCase()) {
    throw new Error(
      `The configured path is not a checkout of ${context.full_name}.`,
    );
  }
  try {
    await git(repositoryRoot, "rev-parse", "--verify", `${mergeSha}^{commit}`);
  } catch {
    await git(repositoryRoot, "fetch", "origin", context.base_ref);
    await git(repositoryRoot, "rev-parse", "--verify", `${mergeSha}^{commit}`);
  }

  const root = path.join(path.dirname(mergetrayDatabasePath()), "worktrees");
  const worktreePath = path.join(
    root,
    `${context.full_name.replaceAll("/", "-")}-pr-${context.number}-deploy-${mergeSha.slice(0, 7)}-${Date.now()}`,
  );
  await mkdir(root, { recursive: true });
  await git(
    repositoryRoot,
    "worktree",
    "add",
    "--detach",
    worktreePath,
    mergeSha,
  );
  return { originUrl, repositoryRoot, worktreePath };
}

async function startMonitorThread(run: PostDeployRun, context: MonitorContext) {
  const checkout = await prepareWorktree(context, run.mergeSha);
  let result: { thread: CodexThread };
  try {
    result = await codexAppServer.request<{ thread: CodexThread }>(
      "thread/start",
      {
        cwd: checkout.worktreePath,
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review",
        sandbox: "read-only",
        serviceName: "mergetray-post-deploy",
      },
    );
  } catch (error) {
    await git(
      checkout.repositoryRoot,
      "worktree",
      "remove",
      checkout.worktreePath,
    );
    throw error;
  }

  await codexAppServer.request("thread/name/set", {
    threadId: result.thread.id,
    name: `Post-deploy capability audit: ${context.full_name}#${context.number}`,
  });
  await codexAppServer.request("thread/metadata/update", {
    threadId: result.thread.id,
    gitInfo: {
      sha: run.mergeSha,
      branch: context.base_ref,
      originUrl: checkout.originUrl,
    },
  });
  const now = Date.now();
  const db = getDatabase();
  db.prepare(
    `INSERT INTO codex_worktrees(
       inbox_item_id, source_session_id, session_id, path,
       head_sha, head_ref, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    context.inbox_item_id,
    result.thread.id,
    result.thread.id,
    checkout.worktreePath,
    run.mergeSha,
    context.base_ref,
    now,
  );
  db.prepare(
    `UPDATE post_deploy_runs
     SET thread_id = ?, worktree_path = ?, updated_at = ? WHERE id = ?`,
  ).run(result.thread.id, checkout.worktreePath, now, run.id);
  return { thread: result.thread, cwd: checkout.worktreePath };
}

function auditPrompt(context: MonitorContext, resumed: boolean) {
  return `Run a read-only post-deploy monitoring capability audit for this merged pull request.

Pull request: ${context.full_name}#${context.number} ${context.title}
PR URL: ${context.url}
Head commit: ${context.head_sha}
Merge commit: ${context.merge_commit_sha}
Merged at: ${context.merged_at ? new Date(context.merged_at).toISOString() : "unknown"}
Production URL: ${context.production_url ?? "not configured"}
Repository instructions: ${context.post_deploy_instructions ?? "none"}
${resumed ? "This run is being resumed. Recheck capabilities rather than relying on earlier conclusions." : ""}

Inspect the merge commit and repository configuration. Then make the smallest safe read-only attempt to establish each capability:
1. Correlate the merge commit with a production deployment using available deployment or Vercel tools. Treat the configured monitoring duration as a total window beginning when this audit starts, including deployment wait time. If the matching deployment is not ready yet, poll read-only deployment status every 5 minutes until it is ready or 30 minutes have elapsed since this audit began. Do not treat a deployment as missing before that wait ends. After it becomes ready, perform the remaining checks and continue any requested heartbeats through the end of the configured window.
2. Once the deployment is ready, inspect already-open connected browser tabs first. Prefer a matching tab in the user's existing Chrome profile because it may already be authenticated. Reuse it when available and allowed. Only create a built-in or new browser session when no suitable connected Chrome tab is available. If a production URL is configured, perform a harmless observation relevant to the change. Do not sign in, enter credentials, submit forms, or mutate production data.
3. Check whether Sentry, PostHog, and Vercel tools are available and authenticated. Make a minimal read-only query when possible.

Do not edit files, change settings, create issues, send messages, deploy, or mutate any external system. Missing configuration is not a system failure. Base every claim on evidence from this run. Return only the structured result.`;
}

export async function executePostDeployCapabilityRun(runId: string) {
  if (activeRuns.has(runId)) return postDeployRunById(runId);
  activeRuns.add(runId);
  let timedOut = false;

  try {
    let run = postDeployRunById(runId);
    if (!run) throw new Error("Post-deploy run not found.");
    const context = monitorContext(run.inboxItemId);
    if (!context) throw new Error("The merged pull request is unavailable.");

    getDatabase()
      .prepare(
        `UPDATE post_deploy_runs
         SET status = 'running', attempts = attempts + 1,
             error = NULL, updated_at = ? WHERE id = ?`,
      )
      .run(Date.now(), runId);
    const updatedRun = postDeployRunById(runId);
    if (!updatedRun) throw new Error("Post-deploy run not found.");
    run = updatedRun;

    const task = run.threadId
      ? await codexAppServer.request<{ thread: CodexThread }>("thread/resume", {
          threadId: run.threadId,
          approvalPolicy: "on-request",
          approvalsReviewer: "auto_review",
        })
      : await startMonitorThread(run, context);
    const thread = task.thread;
    const cwd = "cwd" in task ? task.cwd : (run.worktreePath ?? thread.cwd);
    let activeTurnId: string | undefined;
    let finalText = "";
    let finish!: (value: { status: string; error?: string }) => void;
    const completed = new Promise<{ status: string; error?: string }>(
      (resolve) => {
        finish = resolve;
      },
    );
    const unsubscribe = codexAppServer.subscribe((message) => {
      const params = message.params;
      if (!params || params.threadId !== thread.id) return;
      if (activeTurnId && params.turnId && params.turnId !== activeTurnId)
        return;
      if (message.method === "item/completed") {
        const item = params.item as CodexThreadItem;
        if (item.type === "agentMessage") finalText = item.text;
      }
      if (message.method === "turn/completed") {
        const turn = params.turn as {
          status: string;
          error?: { message?: string } | null;
        };
        finish({ status: turn.status, error: turn.error?.message });
      }
    });

    try {
      const turn = await codexAppServer.request<{ turn: { id: string } }>(
        "turn/start",
        {
          threadId: thread.id,
          input: [
            {
              type: "text",
              text: auditPrompt(context, run.attempts > 1),
              text_elements: [],
            },
          ],
          cwd,
          approvalPolicy: "on-request",
          approvalsReviewer: "auto_review",
          sandboxPolicy: { type: "readOnly", networkAccess: true },
          outputSchema: capabilityAuditResultSchema,
        },
      );
      activeTurnId = turn.turn.id;
      getDatabase()
        .prepare(
          "UPDATE post_deploy_runs SET turn_id = ?, updated_at = ? WHERE id = ?",
        )
        .run(activeTurnId, Date.now(), runId);

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          reject(
            new Error("Capability audit timed out. Resume it to try again."),
          );
        }, auditTimeoutMs);
      });
      const outcome = await Promise.race([completed, timeout]).finally(() =>
        clearTimeout(timeoutId),
      );
      if (outcome.status !== "completed") {
        throw new Error(outcome.error ?? `Codex turn ${outcome.status}.`);
      }
    } finally {
      unsubscribe();
    }

    const result = parseCapabilityAuditResult(finalText);
    if (!result) throw new Error("Codex returned an invalid audit result.");
    const now = Date.now();
    getDatabase()
      .prepare(
        `UPDATE post_deploy_runs
         SET status = 'completed', result_json = ?, error = NULL,
             updated_at = ?, completed_at = ? WHERE id = ?`,
      )
      .run(JSON.stringify(result), now, now, runId);
  } catch (error) {
    getDatabase()
      .prepare(
        `UPDATE post_deploy_runs SET status = ?, error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        timedOut ? "interrupted" : "failed",
        error instanceof Error ? error.message : "Capability audit failed.",
        Date.now(),
        runId,
      );
  } finally {
    activeRuns.delete(runId);
  }
  return postDeployRunById(runId);
}
