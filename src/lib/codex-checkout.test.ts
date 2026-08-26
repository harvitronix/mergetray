import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { inspectCodexCheckout } from "./codex-checkout.ts";

const temporaryDirectories: string[] = [];

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  }).trim();
}

function createRepository() {
  const directory = mkdtempSync(path.join(tmpdir(), "mergetray-checkout-"));
  const repository = path.join(directory, "repository");
  temporaryDirectories.push(directory);
  mkdirSync(repository);
  git(repository, "init", "-b", "main");
  git(
    repository,
    "-c",
    "user.name=MergeTray Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--allow-empty",
    "-m",
    "Initial commit",
  );
  return { directory, repository };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true });
  }
});

describe("inspectCodexCheckout", () => {
  test("recognizes an available primary checkout", async () => {
    const { repository } = createRepository();

    const checkout = await inspectCodexCheckout({
      cwd: repository,
      gitInfo: { branch: "main", originUrl: null, sha: null },
    });

    expect(checkout).toMatchObject({
      available: true,
      branch: "main",
      kind: "primary",
      project: "repository",
    });
  });

  test("blocks a primary checkout after its branch changes", async () => {
    const { repository } = createRepository();
    git(repository, "switch", "-c", "other-branch");

    const checkout = await inspectCodexCheckout({
      cwd: repository,
      gitInfo: { branch: "main", originUrl: null, sha: null },
    });

    expect(checkout.available).toBe(false);
    expect(checkout.reason).toContain("now on other-branch");
  });

  test("allows a detached linked worktree", async () => {
    const { directory, repository } = createRepository();
    const worktree = path.join(directory, "worktree");
    git(repository, "worktree", "add", "--detach", worktree);

    const checkout = await inspectCodexCheckout({
      cwd: worktree,
      gitInfo: { branch: "main", originUrl: null, sha: null },
    });

    expect(checkout).toMatchObject({
      available: true,
      branch: null,
      kind: "worktree",
    });
  });

  test("blocks a missing checkout", async () => {
    const { directory } = createRepository();

    const checkout = await inspectCodexCheckout({
      cwd: path.join(directory, "missing"),
      gitInfo: null,
    });

    expect(checkout).toMatchObject({
      available: false,
      reason: "This task's checkout directory no longer exists.",
    });
  });
});
