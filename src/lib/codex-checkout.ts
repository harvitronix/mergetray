import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { CodexThread } from "./codex-app-server";
import { githubRepository } from "./codex-links";

const execFileAsync = promisify(execFile);

export type CodexCheckout = {
  project: string;
  cwd: string;
  kind: "primary" | "worktree" | "unknown";
  branch: string | null;
  sha: string | null;
  available: boolean;
  reason?: string;
};

async function gitValue(cwd: string, ...args: string[]) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function inspectCodexCheckout(
  thread: Pick<CodexThread, "cwd" | "gitInfo">,
): Promise<CodexCheckout> {
  const unavailable = (reason: string): CodexCheckout => ({
    project: path.basename(thread.cwd),
    cwd: thread.cwd,
    kind: "unknown",
    branch: null,
    sha: null,
    available: false,
    reason,
  });

  try {
    await access(thread.cwd);
  } catch {
    return unavailable("This task's checkout directory no longer exists.");
  }

  const root = await gitValue(thread.cwd, "rev-parse", "--show-toplevel");
  if (!root) return unavailable("This task's directory is not a Git checkout.");

  const [gitDir, commonDir, branch, sha, originUrl] = await Promise.all([
    gitValue(thread.cwd, "rev-parse", "--absolute-git-dir"),
    gitValue(
      thread.cwd,
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ),
    gitValue(thread.cwd, "symbolic-ref", "--quiet", "--short", "HEAD"),
    gitValue(thread.cwd, "rev-parse", "HEAD"),
    gitValue(thread.cwd, "config", "--get", "remote.origin.url"),
  ]);
  const kind =
    gitDir && commonDir && path.resolve(gitDir) !== path.resolve(commonDir)
      ? "worktree"
      : "primary";
  const checkout: CodexCheckout = {
    project: path.basename(root),
    cwd: thread.cwd,
    kind,
    branch: branch ?? null,
    sha: sha ?? null,
    available: true,
  };

  const recordedRepository = thread.gitInfo?.originUrl
    ? githubRepository(thread.gitInfo.originUrl)
    : undefined;
  if (
    recordedRepository &&
    recordedRepository !== githubRepository(originUrl ?? "")
  ) {
    return {
      ...checkout,
      available: false,
      reason: "This path now points to a different Git repository.",
    };
  }

  const recordedBranch = thread.gitInfo?.branch;
  const branchChanged =
    recordedBranch &&
    recordedBranch !== branch &&
    (kind === "primary" || branch !== undefined);
  if (branchChanged) {
    return {
      ...checkout,
      available: false,
      reason: `This task was created on ${recordedBranch}, but the checkout is now on ${branch ?? "detached HEAD"}.`,
    };
  }

  return checkout;
}
