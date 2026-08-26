import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type CodexThread, codexAppServer } from "./codex-app-server.ts";
import {
  codexNewTask,
  codexRecoveryOption,
  createCodexThreadForInboxItem,
  recoverCodexThread,
  setRepositoryLocalPath,
} from "./codex-worktrees.ts";
import { closeDatabase, getDatabase } from "./database.ts";

let directory: string;
let repository: string;
let headSha: string;

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  }).trim();
}

function thread(cwd: string): CodexThread {
  return {
    id: "source-session",
    name: "Fix the PR",
    preview: "Fix the PR",
    cwd,
    gitInfo: {
      sha: headSha,
      branch: "feature/fix",
      originUrl: "git@github.com:acme/widgets.git",
    },
    turns: [],
  };
}

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "mergetray-worktrees-"));
  process.env.MERGETRAY_DATA_DIR = path.join(directory, "data");
  repository = path.join(directory, "repository");
  mkdirSync(repository);
  git(repository, "init", "-b", "main");
  git(repository, "remote", "add", "origin", "git@github.com:acme/widgets.git");
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
  headSha = git(repository, "rev-parse", "HEAD");

  getDatabase().exec(`
    INSERT INTO repositories(
      id, github_repo_id, owner, name, full_name, private, archived, selected
    ) VALUES (1, 1, 'acme', 'widgets', 'acme/widgets', 0, 0, 1);
    INSERT INTO inbox_items(
      id, repository_id, number, title, url, author_login, state, updated_at, last_synced_at
    ) VALUES (1, 1, 7, 'Fix the PR', 'https://github.com/acme/widgets/pull/7', 'author', 'open', 1, 1);
    INSERT INTO pull_request_details(
      inbox_item_id, draft, head_sha, head_ref, base_ref
    ) VALUES (1, 0, '${headSha}', 'feature/fix', 'main');
    INSERT INTO agent_session_links(inbox_item_id, provider, session_id)
    VALUES (1, 'codex', 'source-session');
  `);
});

afterEach(() => {
  vi.restoreAllMocks();
  closeDatabase();
  delete process.env.MERGETRAY_DATA_DIR;
  rmSync(directory, { recursive: true });
});

describe("Codex worktree recovery", () => {
  test("validates and stores a repository checkout", async () => {
    await setRepositoryLocalPath("1", repository);

    expect(
      getDatabase()
        .prepare("SELECT local_path FROM repositories WHERE id = 1")
        .get(),
    ).toEqual({
      local_path: git(repository, "rev-parse", "--show-toplevel"),
    });
    await expect(
      setRepositoryLocalPath("1", path.join(directory, "missing")),
    ).rejects.toThrow("Choose an available Git checkout of acme/widgets.");
    await expect(codexNewTask("1")).resolves.toMatchObject({
      repository: "acme/widgets",
      number: 7,
      available: true,
    });
  });

  test("creates and links a new PR task in a detached worktree", async () => {
    await setRepositoryLocalPath("1", repository);
    const stages: string[] = [];
    let taskCwd = "";
    vi.spyOn(codexAppServer, "request").mockImplementation((async (
      method: string,
      params: Record<string, unknown>,
    ) => {
      if (method === "thread/start") {
        taskCwd = String(params.cwd);
        return { thread: { ...thread(taskCwd), id: "new-session" } };
      }
      return {};
    }) as typeof codexAppServer.request);

    await expect(
      createCodexThreadForInboxItem("1", (stage) => stages.push(stage)),
    ).resolves.toMatchObject({ thread: { id: "new-session" } });

    expect(stages).toEqual([
      "preparingCheckout",
      "creatingWorktree",
      "startingTask",
      "linkingTask",
    ]);
    expect(git(taskCwd, "rev-parse", "HEAD")).toBe(headSha);
    expect(git(taskCwd, "rev-parse", "--abbrev-ref", "HEAD")).toBe("HEAD");
    expect(
      getDatabase().prepare("SELECT session_id FROM agent_session_links").get(),
    ).toEqual({ session_id: "new-session" });
    expect(
      getDatabase()
        .prepare("SELECT source_session_id, session_id FROM codex_worktrees")
        .get(),
    ).toEqual({
      source_session_id: "new-session",
      session_id: "new-session",
    });
  });

  test("forks an unavailable linked task into a detached worktree", async () => {
    await setRepositoryLocalPath("1", repository);
    const missingCwd = path.join(directory, "missing");
    expect(await codexRecoveryOption(thread(missingCwd))).toMatchObject({
      available: true,
    });

    let forkCwd = "";
    vi.spyOn(codexAppServer, "request").mockImplementation((async (
      method: string,
      params: Record<string, unknown>,
    ) => {
      if (method === "thread/fork") {
        forkCwd = String(params.cwd);
        return { thread: { ...thread(forkCwd), id: "forked-session" } };
      }
      return {};
    }) as typeof codexAppServer.request);

    await expect(recoverCodexThread(thread(missingCwd))).resolves.toEqual({
      threadId: "forked-session",
    });
    expect(git(forkCwd, "rev-parse", "HEAD")).toBe(headSha);
    expect(git(forkCwd, "rev-parse", "--abbrev-ref", "HEAD")).toBe("HEAD");
    expect(
      getDatabase().prepare("SELECT session_id FROM agent_session_links").get(),
    ).toEqual({ session_id: "forked-session" });
    expect(
      getDatabase()
        .prepare(
          "SELECT source_session_id, session_id, head_ref FROM codex_worktrees",
        )
        .get(),
    ).toEqual({
      source_session_id: "source-session",
      session_id: "forked-session",
      head_ref: "feature/fix",
    });
  });
});
