import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
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

async function git(cwd: string, ...args: string[]) {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
    timeout: 60_000,
  });
  return stdout.trim();
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
              repositories.local_path, inbox_items.number,
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

function recordRecovery(
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
      `UPDATE agent_session_links SET session_id = ?
       WHERE inbox_item_id = ? AND provider = 'codex' AND session_id = ?`,
    ).run(sessionId, context.inbox_item_id, sourceSessionId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
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

  const worktreeRoot = path.join(
    path.dirname(mergetrayDatabasePath()),
    "worktrees",
  );
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

  let fork: { thread: CodexThread };
  try {
    fork = await codexAppServer.request<{ thread: CodexThread }>(
      "thread/fork",
      {
        threadId: thread.id,
        cwd: worktreePath,
        approvalPolicy: "on-request",
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
  recordRecovery(context, thread.id, fork.thread.id, worktreePath);

  return { threadId: fork.thread.id };
}
