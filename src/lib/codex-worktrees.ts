import { execFile } from "node:child_process";
import { lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { type CodexThread, codexAppServer } from "./codex-app-server";
import { githubRepository } from "./codex-links";
import { getDatabase, mergetrayDatabasePath } from "./database";

const execFileAsync = promisify(execFile);

type RecoveryContext = {
  inbox_item_id: number;
  full_name: string;
  local_path: string | null;
  number: number;
  title: string;
  url: string;
  head_sha: string;
  head_ref: string;
};

type LocalRepository = {
  root: string;
  originUrl: string;
};

export type CodexRecoveryOption = {
  available: boolean;
  reason?: string;
};

export type CodexNewTask = {
  inboxItemId: string;
  repository: string;
  number: number;
  title: string;
  url: string;
  branch: string;
  sha: string;
  available: boolean;
  reason?: string;
};

export type CodexTaskSetupStage =
  | "preparingCheckout"
  | "creatingWorktree"
  | "startingTask"
  | "linkingTask";

export type CodexManagedWorktree = {
  id: string;
  repository: string;
  number: number;
  title: string;
  url: string;
  pullRequestState: string;
  sessionId: string;
  path: string;
  branch: string;
  sha: string;
  createdAt: number;
  cleanupState:
    | "ready"
    | "active"
    | "dirty"
    | "missing"
    | "unregistered"
    | "unavailable";
  detail: string;
  canCleanup: boolean;
};

type ManagedWorktreeRow = {
  id: number;
  inbox_item_id: number;
  full_name: string;
  number: number;
  title: string;
  url: string;
  state: string;
  session_id: string;
  current_session_id: string | null;
  path: string;
  head_ref: string;
  head_sha: string;
  created_at: number;
  archived_at: number | null;
};

type WorktreeCheckout =
  | { state: "missing" }
  | { state: "unregistered"; detail: string }
  | { state: "dirty" }
  | { state: "ready"; repositoryRoot: string; worktreePath: string };

async function git(cwd: string, ...args: string[]) {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
    timeout: 60_000,
  });
  return stdout.trim();
}

function managedWorktreeRoot() {
  return path.join(path.dirname(mergetrayDatabasePath()), "worktrees");
}

async function localRepository(cwd: string, expectedRepository: string) {
  const [root, originUrl] = await Promise.all([
    git(cwd, "rev-parse", "--show-toplevel"),
    git(cwd, "config", "--get", "remote.origin.url"),
  ]);
  if (githubRepository(originUrl) !== expectedRepository.toLowerCase()) {
    throw new Error(`This path is not a checkout of ${expectedRepository}.`);
  }
  return { root, originUrl };
}

function recoveryContext(threadId: string) {
  return getDatabase()
    .prepare(
      `SELECT inbox_items.id AS inbox_item_id, repositories.full_name,
              repositories.local_path, inbox_items.number, inbox_items.title,
              inbox_items.url,
              pull_request_details.head_sha, pull_request_details.head_ref
       FROM agent_session_links
       JOIN inbox_items ON inbox_items.id = agent_session_links.inbox_item_id
       JOIN repositories ON repositories.id = inbox_items.repository_id
       JOIN pull_request_details ON pull_request_details.inbox_item_id = inbox_items.id
       WHERE agent_session_links.provider = 'codex'
         AND agent_session_links.session_id = ?
         AND inbox_items.state = 'open'`,
    )
    .get(threadId) as RecoveryContext | undefined;
}

function pullRequestContext(inboxItemId: string) {
  return getDatabase()
    .prepare(
      `SELECT inbox_items.id AS inbox_item_id, repositories.full_name,
              repositories.local_path, inbox_items.number, inbox_items.title,
              inbox_items.url, pull_request_details.head_sha,
              pull_request_details.head_ref
       FROM inbox_items
       JOIN repositories ON repositories.id = inbox_items.repository_id
       JOIN pull_request_details ON pull_request_details.inbox_item_id = inbox_items.id
       WHERE inbox_items.id = ? AND inbox_items.state = 'open'`,
    )
    .get(inboxItemId) as RecoveryContext | undefined;
}

async function recoveryRepository(
  context: RecoveryContext,
  threadCwd: string,
): Promise<LocalRepository | undefined> {
  for (const candidate of [context.local_path, threadCwd]) {
    if (!candidate) continue;
    try {
      return await localRepository(candidate, context.full_name);
    } catch {
      // Try the task checkout if the configured checkout is no longer usable.
    }
  }
}

export async function setRepositoryLocalPath(
  repositoryId: string,
  value: string,
) {
  const db = getDatabase();
  const repository = db
    .prepare("SELECT full_name FROM repositories WHERE id = ? AND selected = 1")
    .get(repositoryId) as { full_name: string } | undefined;
  if (!repository) throw new Error("Repository not found.");

  const trimmed = value.trim();
  let localPath: string | null = null;
  if (trimmed) {
    try {
      localPath = (
        await localRepository(path.resolve(trimmed), repository.full_name)
      ).root;
    } catch {
      throw new Error(
        `Choose an available Git checkout of ${repository.full_name}.`,
      );
    }
  }
  db.prepare("UPDATE repositories SET local_path = ? WHERE id = ?").run(
    localPath,
    repositoryId,
  );
}

export async function codexRecoveryOption(
  thread: Pick<CodexThread, "id" | "cwd">,
): Promise<CodexRecoveryOption | undefined> {
  const context = recoveryContext(thread.id);
  if (!context) return;
  const repository = await recoveryRepository(context, thread.cwd);
  return {
    available: Boolean(repository),
    reason: repository
      ? undefined
      : `Set an available local checkout for ${context.full_name} in Settings first.`,
  };
}

export async function codexNewTask(
  inboxItemId: string,
): Promise<CodexNewTask | undefined> {
  const context = pullRequestContext(inboxItemId);
  if (!context) return;

  let reason: string | undefined;
  if (!/^[0-9a-f]{40}$/i.test(context.head_sha)) {
    reason = "The pull request head commit is invalid.";
  } else if (!context.local_path) {
    reason = `Set a local checkout for ${context.full_name} in Settings first.`;
  } else {
    try {
      await localRepository(context.local_path, context.full_name);
    } catch {
      reason = `Set an available local checkout for ${context.full_name} in Settings first.`;
    }
  }

  return {
    inboxItemId,
    repository: context.full_name,
    number: context.number,
    title: context.title,
    url: context.url,
    branch: context.head_ref,
    sha: context.head_sha,
    available: !reason,
    reason,
  };
}

async function ensureCommit(
  repository: LocalRepository,
  context: RecoveryContext,
) {
  try {
    await git(
      repository.root,
      "rev-parse",
      "--verify",
      `${context.head_sha}^{commit}`,
    );
  } catch {
    await git(
      repository.root,
      "fetch",
      "origin",
      `refs/pull/${context.number}/head`,
    );
    await git(
      repository.root,
      "rev-parse",
      "--verify",
      `${context.head_sha}^{commit}`,
    );
  }
}

function recordWorktree(
  context: RecoveryContext,
  sourceSessionId: string,
  sessionId: string,
  worktreePath: string,
) {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO codex_worktrees(
        inbox_item_id, source_session_id, session_id, path,
        head_sha, head_ref, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      context.inbox_item_id,
      sourceSessionId,
      sessionId,
      worktreePath,
      context.head_sha,
      context.head_ref,
      Date.now(),
    );
    db.prepare(
      `DELETE FROM agent_session_auto_link_suppressions
       WHERE inbox_item_id = ? AND provider = 'codex'`,
    ).run(context.inbox_item_id);
    db.prepare(
      `INSERT INTO agent_session_links(inbox_item_id, provider, session_id)
       VALUES (?, 'codex', ?)
       ON CONFLICT(inbox_item_id, provider)
       DO UPDATE SET session_id = excluded.session_id`,
    ).run(context.inbox_item_id, sessionId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function createDetachedWorktree(
  repository: LocalRepository,
  context: RecoveryContext,
) {
  const worktreeRoot = managedWorktreeRoot();
  const worktreePath = path.join(
    worktreeRoot,
    `${context.full_name.replaceAll("/", "-")}-pr-${context.number}-${context.head_sha.slice(0, 7)}-${Date.now()}`,
  );
  await mkdir(worktreeRoot, { recursive: true });
  await git(
    repository.root,
    "worktree",
    "add",
    "--detach",
    worktreePath,
    context.head_sha,
  );
  return worktreePath;
}

export async function createCodexThreadForInboxItem(
  inboxItemId: string,
  onStage: (stage: CodexTaskSetupStage) => void,
) {
  const context = pullRequestContext(inboxItemId);
  if (!context) throw new Error("This pull request is no longer open.");
  if (!/^[0-9a-f]{40}$/i.test(context.head_sha)) {
    throw new Error("The pull request head commit is invalid.");
  }
  if (!context.local_path) {
    throw new Error(
      `Set a local checkout for ${context.full_name} in Settings first.`,
    );
  }

  onStage("preparingCheckout");
  const repository = await localRepository(
    context.local_path,
    context.full_name,
  );
  await ensureCommit(repository, context);
  onStage("creatingWorktree");
  const worktreePath = await createDetachedWorktree(repository, context);

  onStage("startingTask");
  let result: { thread: CodexThread };
  try {
    result = await codexAppServer.request<{ thread: CodexThread }>(
      "thread/start",
      {
        cwd: worktreePath,
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review",
        sandbox: "read-only",
        serviceName: "mergetray",
      },
    );
  } catch (error) {
    await git(repository.root, "worktree", "remove", worktreePath);
    throw error;
  }
  await codexAppServer.request("thread/name/set", {
    threadId: result.thread.id,
    name: `${context.full_name}#${context.number}: ${context.title}`,
  });
  await codexAppServer.request("thread/metadata/update", {
    threadId: result.thread.id,
    gitInfo: {
      sha: context.head_sha,
      branch: context.head_ref,
      originUrl: repository.originUrl,
    },
  });

  onStage("linkingTask");
  recordWorktree(context, result.thread.id, result.thread.id, worktreePath);
  return result;
}

export async function recoverCodexThread(thread: CodexThread) {
  const context = recoveryContext(thread.id);
  if (!context)
    throw new Error("This task is not linked to an open pull request.");
  if (!/^[0-9a-f]{40}$/i.test(context.head_sha)) {
    throw new Error("The pull request head commit is invalid.");
  }

  const repository = await recoveryRepository(context, thread.cwd);
  if (!repository) {
    throw new Error(
      `Set an available local checkout for ${context.full_name} in Settings first.`,
    );
  }
  await ensureCommit(repository, context);

  const worktreePath = await createDetachedWorktree(repository, context);

  let fork: { thread: CodexThread };
  try {
    fork = await codexAppServer.request<{ thread: CodexThread }>(
      "thread/fork",
      {
        threadId: thread.id,
        cwd: worktreePath,
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review",
        sandbox: "read-only",
        serviceName: "mergetray",
      },
    );
  } catch (error) {
    try {
      await git(repository.root, "worktree", "remove", worktreePath);
    } catch {
      throw new Error(
        `Codex could not fork the task. The unused worktree remains at ${worktreePath}.`,
        { cause: error },
      );
    }
    throw error;
  }
  await codexAppServer.request("thread/metadata/update", {
    threadId: fork.thread.id,
    gitInfo: {
      sha: context.head_sha,
      branch: context.head_ref,
      originUrl: repository.originUrl,
    },
  });
  recordWorktree(context, thread.id, fork.thread.id, worktreePath);

  return { threadId: fork.thread.id };
}

function managedWorktreeRows() {
  return getDatabase()
    .prepare(
      `SELECT codex_worktrees.id, codex_worktrees.inbox_item_id,
              repositories.full_name, inbox_items.number,
              inbox_items.title, inbox_items.url, inbox_items.state,
              codex_worktrees.session_id, agent_session_links.session_id AS current_session_id,
              codex_worktrees.path, codex_worktrees.head_ref,
              codex_worktrees.head_sha, codex_worktrees.created_at,
              codex_worktrees.archived_at
       FROM codex_worktrees
       JOIN inbox_items ON inbox_items.id = codex_worktrees.inbox_item_id
       JOIN repositories ON repositories.id = inbox_items.repository_id
       LEFT JOIN agent_session_links
         ON agent_session_links.inbox_item_id = inbox_items.id
        AND agent_session_links.provider = 'codex'
       WHERE codex_worktrees.removed_at IS NULL
       ORDER BY codex_worktrees.created_at DESC`,
    )
    .all() as ManagedWorktreeRow[];
}

async function inspectManagedWorktree(
  worktreePath: string,
): Promise<WorktreeCheckout> {
  const root = path.resolve(managedWorktreeRoot());
  const resolvedPath = path.resolve(worktreePath);
  if (path.dirname(resolvedPath) !== root) {
    return {
      state: "unregistered",
      detail: "The recorded path is outside MergeTray's managed directory.",
    };
  }

  let stats: Awaited<ReturnType<typeof lstat>>;
  try {
    stats = await lstat(resolvedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { state: "missing" };
    }
    throw error;
  }
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    return {
      state: "unregistered",
      detail: "The recorded path is not a regular directory.",
    };
  }

  const [realRoot, realWorktree] = await Promise.all([
    realpath(root),
    realpath(resolvedPath),
  ]);
  if (path.dirname(realWorktree) !== realRoot) {
    return {
      state: "unregistered",
      detail:
        "The recorded path does not resolve inside the managed directory.",
    };
  }

  try {
    const [checkoutRoot, worktrees, changes, commonDir] = await Promise.all([
      git(realWorktree, "rev-parse", "--show-toplevel"),
      git(realWorktree, "worktree", "list", "--porcelain"),
      git(realWorktree, "status", "--porcelain", "--untracked-files=all"),
      git(
        realWorktree,
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ),
    ]);
    if (
      path.resolve(checkoutRoot) !== realWorktree ||
      !worktrees.split("\n").some((line) => line === `worktree ${realWorktree}`)
    ) {
      return {
        state: "unregistered",
        detail: "Git no longer recognizes this directory as that worktree.",
      };
    }
    if (changes) return { state: "dirty" };
    return {
      state: "ready",
      repositoryRoot: path.dirname(commonDir),
      worktreePath: realWorktree,
    };
  } catch {
    return {
      state: "unregistered",
      detail: "Git could not inspect this managed worktree.",
    };
  }
}

async function readManagedThread(sessionId: string) {
  return codexAppServer.request<{ thread: CodexThread }>("thread/read", {
    threadId: sessionId,
    includeTurns: false,
  });
}

export async function listCodexManagedWorktrees(): Promise<
  CodexManagedWorktree[]
> {
  return Promise.all(
    managedWorktreeRows().map(async (row) => {
      const [checkout, task] = await Promise.all([
        inspectManagedWorktree(row.path),
        readManagedThread(row.session_id).catch(() => undefined),
      ]);
      const base = {
        id: String(row.id),
        repository: row.full_name,
        number: row.number,
        title: row.title,
        url: row.url,
        pullRequestState: row.state,
        sessionId: row.session_id,
        path: row.path,
        branch: row.head_ref,
        sha: row.head_sha,
        createdAt: row.created_at,
      };

      if (task?.thread.status?.type === "active") {
        return {
          ...base,
          cleanupState: "active" as const,
          detail: "The Codex task is currently active.",
          canCleanup: false,
        };
      }
      if (checkout.state === "dirty") {
        return {
          ...base,
          cleanupState: "dirty" as const,
          detail: "This worktree has uncommitted changes.",
          canCleanup: false,
        };
      }
      if (checkout.state === "unregistered") {
        return {
          ...base,
          cleanupState: "unregistered" as const,
          detail: checkout.detail,
          canCleanup: false,
        };
      }
      if (!task && !row.archived_at) {
        return {
          ...base,
          cleanupState: "unavailable" as const,
          detail: "The Codex task could not be inspected.",
          canCleanup: false,
        };
      }
      if (checkout.state === "missing") {
        return {
          ...base,
          cleanupState: "missing" as const,
          detail:
            "The directory is already missing; its task can be archived and the record cleared.",
          canCleanup: true,
        };
      }
      return {
        ...base,
        cleanupState: "ready" as const,
        detail:
          row.current_session_id === row.session_id
            ? "The worktree is clean and still linked to this pull request."
            : "The worktree is clean and has been superseded by another task.",
        canCleanup: true,
      };
    }),
  );
}

async function codexThreadIsArchived(sessionId: string) {
  const result = await codexAppServer.request<{ data: CodexThread[] }>(
    "thread/list",
    {
      limit: 20,
      archived: true,
      searchTerm: sessionId,
      useStateDbOnly: true,
    },
  );
  return result.data.some((thread) => thread.id === sessionId);
}

export async function cleanupCodexManagedWorktree(id: string) {
  const row = managedWorktreeRows().find((item) => String(item.id) === id);
  if (!row) throw new Error("Managed worktree not found.");

  const checkout = await inspectManagedWorktree(row.path);
  if (checkout.state === "dirty") {
    throw new Error("Commit or discard the worktree's changes before cleanup.");
  }
  if (checkout.state === "unregistered") throw new Error(checkout.detail);

  let archived = Boolean(row.archived_at);
  let task: { thread: CodexThread } | undefined;
  try {
    task = await readManagedThread(row.session_id);
  } catch {
    if (!archived) archived = await codexThreadIsArchived(row.session_id);
    if (!archived) throw new Error("The Codex task could not be inspected.");
  }
  if (task?.thread.status?.type === "active") {
    throw new Error("Wait for the Codex task to finish before cleanup.");
  }

  if (!archived) archived = await codexThreadIsArchived(row.session_id);
  if (!archived) {
    await codexAppServer.request("thread/archive", {
      threadId: row.session_id,
    });
  }
  if (!row.archived_at) {
    getDatabase()
      .prepare("UPDATE codex_worktrees SET archived_at = ? WHERE id = ?")
      .run(Date.now(), row.id);
  }

  if (checkout.state === "ready") {
    await git(
      checkout.repositoryRoot,
      "worktree",
      "remove",
      checkout.worktreePath,
    );
    await git(checkout.repositoryRoot, "worktree", "prune");
  }

  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE codex_worktrees SET removed_at = ? WHERE id = ?").run(
      Date.now(),
      row.id,
    );
    db.prepare(
      `DELETE FROM agent_session_links
       WHERE inbox_item_id = ? AND provider = 'codex' AND session_id = ?`,
    ).run(row.inbox_item_id, row.session_id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
