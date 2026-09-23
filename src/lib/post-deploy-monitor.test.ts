import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type CodexThread, codexAppServer } from "./codex-app-server.ts";
import { closeDatabase, getDatabase } from "./database.ts";
import {
  executePostDeployCapabilityRun,
  postDeployRunById,
  queuePostDeployCapabilityRun,
  setRepositoryPostDeploySettings,
} from "./post-deploy-monitor.ts";
import { parseCapabilityAuditResult } from "./post-deploy-result.ts";

let directory: string;
let repository: string;
let mergeSha: string;

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  }).trim();
}

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "mergetray-post-deploy-"));
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
    "Merged change",
  );
  mergeSha = git(repository, "rev-parse", "HEAD");

  getDatabase().exec(`
    INSERT INTO repositories(
      id, github_repo_id, owner, name, full_name, private, archived, selected,
      local_path, production_url, post_deploy_instructions
    ) VALUES (
      1, 1, 'acme', 'widgets', 'acme/widgets', 0, 0, 1,
      '${repository}', 'https://example.com', 'Check the home page.'
    );
    INSERT INTO inbox_items(
      id, repository_id, number, title, url, author_login, state,
      updated_at, closed_at, last_synced_at
    ) VALUES (
      1, 1, 7, 'Ship the feature', 'https://github.com/acme/widgets/pull/7',
      'author', 'merged', 1, 1, 1
    );
    INSERT INTO pull_request_details(
      inbox_item_id, draft, head_sha, head_ref, base_ref,
      merged_at, merge_commit_sha
    ) VALUES (1, 0, '${mergeSha}', 'feature/ship', 'main', 1, '${mergeSha}');
  `);
});

afterEach(() => {
  vi.restoreAllMocks();
  closeDatabase();
  delete process.env.MERGETRAY_DATA_DIR;
  rmSync(directory, { recursive: true });
});

describe("post-deploy capability runs", () => {
  test("persists a structured audit and resumes the same task", async () => {
    let listener: Parameters<typeof codexAppServer.subscribe>[0] = () => {};
    let taskCwd = "";
    let turn = 0;
    const methods: string[] = [];
    const prompts: string[] = [];
    vi.spyOn(codexAppServer, "subscribe").mockImplementation((next) => {
      listener = next;
      return () => true;
    });
    vi.spyOn(codexAppServer, "request").mockImplementation((async (
      method: string,
      params: Record<string, unknown>,
    ) => {
      methods.push(method);
      if (method === "thread/start") {
        taskCwd = String(params.cwd);
        return {
          thread: {
            id: "monitor-thread",
            name: null,
            preview: "",
            cwd: taskCwd,
            gitInfo: null,
            turns: [],
          } satisfies CodexThread,
        };
      }
      if (method === "thread/resume") {
        return {
          thread: {
            id: "monitor-thread",
            name: "Post-deploy capability audit",
            preview: "",
            cwd: taskCwd,
            gitInfo: null,
            turns: [],
          } satisfies CodexThread,
        };
      }
      if (method === "turn/start") {
        prompts.push(
          String(
            (params.input as Array<{ text: string }> | undefined)?.[0]?.text,
          ),
        );
        turn += 1;
        const turnId = `turn-${turn}`;
        queueMicrotask(() => {
          listener({
            method: "item/completed",
            params: {
              threadId: "monitor-thread",
              turnId,
              item: {
                type: "agentMessage",
                id: `message-${turn}`,
                text: JSON.stringify({
                  overall: "partial",
                  summary: "Browser works; telemetry needs configuration.",
                  checks: [
                    {
                      capability: "production_browser",
                      status: "available",
                      evidence: "Loaded the configured URL.",
                    },
                  ],
                  nextStep: "Connect telemetry tools.",
                }),
              },
            },
          });
          listener({
            method: "turn/completed",
            params: {
              threadId: "monitor-thread",
              turnId,
              turn: { status: "completed", error: null },
            },
          });
        });
        return { turn: { id: turnId } };
      }
      return {};
    }) as typeof codexAppServer.request);

    const queued = queuePostDeployCapabilityRun("1");
    await executePostDeployCapabilityRun(queued.id);
    const first = postDeployRunById(queued.id);

    expect(first).toMatchObject({
      status: "completed",
      attempts: 1,
      threadId: "monitor-thread",
      result: { overall: "partial" },
    });
    expect(existsSync(taskCwd)).toBe(true);
    expect(git(taskCwd, "rev-parse", "HEAD")).toBe(mergeSha);

    queuePostDeployCapabilityRun("1");
    await executePostDeployCapabilityRun(queued.id);
    expect(postDeployRunById(queued.id)).toMatchObject({
      status: "completed",
      attempts: 2,
      threadId: "monitor-thread",
    });
    expect(methods.filter((method) => method === "thread/start")).toHaveLength(
      1,
    );
    expect(methods.filter((method) => method === "thread/resume")).toHaveLength(
      1,
    );
    expect(prompts[0]).toContain("existing Chrome profile");
    expect(prompts[0]).toContain("poll read-only deployment status");
    expect(prompts[0]).toContain(
      "total window beginning when this audit starts",
    );
  });

  test("recognizes only structured audit results", () => {
    expect(parseCapabilityAuditResult('{"summary":"not an audit"}')).toBe(
      undefined,
    );
    expect(
      parseCapabilityAuditResult(
        JSON.stringify({
          overall: "ready",
          summary: "Deployment verified.",
          checks: [],
          nextStep: "None.",
        }),
      ),
    ).toMatchObject({ overall: "ready" });
  });

  test("stores repository monitoring instructions", () => {
    setRepositoryPostDeploySettings(
      "1",
      "https://app.example.com",
      "Use the read-only smoke account.",
    );
    expect(
      getDatabase()
        .prepare(
          "SELECT production_url, post_deploy_instructions FROM repositories WHERE id = 1",
        )
        .get(),
    ).toEqual({
      production_url: "https://app.example.com",
      post_deploy_instructions: "Use the read-only smoke account.",
    });
  });
});
