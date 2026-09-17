import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { closeDatabase, getDatabase, setSetting } from "./database.ts";
import {
  githubDataRevision,
  syncGithub,
  syncGithubItem,
  upsertSelectedRepository,
} from "./github-sync.ts";
import { githubWebhookTargets } from "./github-webhooks.ts";
import { ignoreCheckUpdatesSetting } from "./inbox-preferences.ts";

vi.mock("./github-auth.ts", () => ({
  githubToken: async () => "test-token",
}));

const updatedAt = "2026-08-01T12:00:00Z";
const pullRequest = {
  id: 101,
  node_id: "PR_node_101",
  number: 7,
  title: "Test polling",
  html_url: "https://github.com/acme/widgets/pull/7",
  user: { id: 2, login: "author" },
  state: "open",
  draft: false,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: updatedAt,
  closed_at: null,
  merged_at: null,
  head: { sha: "abc123", ref: "polling" },
  base: { ref: "main" },
  additions: 4,
  deletions: 1,
  changed_files: 2,
};

let dataDirectory: string;
let requests: string[];
const volatilePullRequest = {
  id: pullRequest.node_id,
  state: "OPEN",
  updatedAt,
  closedAt: null,
  mergedAt: null,
  headRefOid: pullRequest.head.sha,
  autoMergeRequest: { enabledAt: updatedAt } as { enabledAt: string } | null,
  reviewRequests: { nodes: [] },
  reviews: { nodes: [] },
  statusCheckRollup: {
    state: "SUCCESS",
    contexts: {
      nodes: [] as Array<{ status: string; conclusion: string | null }>,
    },
  },
};
let livePullRequest: typeof volatilePullRequest;

function dismissPullRequest(snoozed: boolean) {
  getDatabase()
    .prepare(
      "INSERT INTO user_inbox_item_states(inbox_item_id, status, marked_done_at, snoozed_until) VALUES (1, 'done', ?, ?)",
    )
    .run(Date.now(), snoozed ? Date.now() + 3_600_000 : null);
}

beforeEach(() => {
  dataDirectory = mkdtempSync(join(tmpdir(), "mergetray-sync-"));
  process.env.MERGETRAY_DATA_DIR = dataDirectory;
  requests = [];
  livePullRequest = structuredClone(volatilePullRequest);
  vi.stubGlobal(
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/graphql")) {
        return Response.json({
          data: {
            p0: livePullRequest,
          },
        });
      }

      const headers = new Headers(init?.headers);
      if (headers.has("if-none-match"))
        return new Response(null, { status: 304 });
      if (url.endsWith("/user"))
        return Response.json({ id: 1, login: "viewer" });
      if (url.includes("/user/teams?")) {
        return Response.json([], { headers: { etag: '"teams"' } });
      }
      if (url.includes("/repos/acme/widgets/pulls?state=open")) {
        return Response.json([pullRequest], { headers: { etag: '"pulls"' } });
      }
      if (url.endsWith("/repos/acme/widgets/pulls/7")) {
        return Response.json(pullRequest);
      }
      if (url.includes("/repos/acme/widgets/pulls/7/commits?")) {
        return Response.json([], { headers: { etag: '"commits"' } });
      }
      if (url.includes("/repos/acme/widgets/pulls/7/files?")) {
        return Response.json(
          [
            { filename: "src/app.ts", additions: 4, deletions: 1 },
            { filename: "src/app.test.ts", additions: 0, deletions: 0 },
          ],
          { headers: { etag: '"files"' } },
        );
      }
      if (url.includes("/repos/acme/widgets/issues/7/timeline?")) {
        return Response.json([], { headers: { etag: '"timeline"' } });
      }
      return new Response(`Unexpected request: ${url}`, { status: 500 });
    },
  );

  upsertSelectedRepository({
    id: 10,
    name: "widgets",
    full_name: "acme/widgets",
    private: false,
    archived: false,
    owner: { login: "acme" },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  closeDatabase();
  delete process.env.MERGETRAY_DATA_DIR;
  rmSync(dataDirectory, { recursive: true });
});

describe("GitHub polling", () => {
  test.each([
    "done",
    "snoozed",
  ])("keeps %s PRs hidden through check updates when enabled", async (status) => {
    const now = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.parse(updatedAt) + 1_000);
    const checks = livePullRequest.statusCheckRollup;
    checks.state = "PENDING";
    checks.contexts.nodes = Array.from({ length: 6 }, () => ({
      status: "IN_PROGRESS",
      conclusion: null,
    }));
    await syncGithub(true);
    setSetting(ignoreCheckUpdatesSetting, "true");
    dismissPullRequest(status === "snoozed");
    const savedState = getDatabase()
      .prepare("SELECT * FROM user_inbox_item_states")
      .get();

    for (const pendingCount of [5, 4, 0]) {
      now.mockReturnValue(Date.now() + 1_000);
      checks.state = pendingCount ? "PENDING" : "FAILURE";
      checks.contexts.nodes = checks.contexts.nodes.map((_, index) => ({
        status: index < pendingCount ? "IN_PROGRESS" : "COMPLETED",
        conclusion: index < pendingCount ? null : "FAILURE",
      }));
      await syncGithubItem({ repository: "acme/widgets", number: 7 });
      expect(
        getDatabase().prepare("SELECT * FROM user_inbox_item_states").get(),
      ).toEqual(savedState);
      expect(
        getDatabase()
          .prepare(
            "SELECT pending_count, failing_count FROM pull_request_statuses",
          )
          .get(),
      ).toEqual({
        pending_count: pendingCount,
        failing_count: 6 - pendingCount,
      });
    }

    checks.state = "SUCCESS";
    checks.contexts.nodes = checks.contexts.nodes.map(() => ({
      status: "COMPLETED",
      conclusion: "SUCCESS",
    }));
    await syncGithub(true);
    expect(
      getDatabase().prepare("SELECT * FROM user_inbox_item_states").get(),
    ).toEqual(savedState);
    expect(
      getDatabase()
        .prepare("SELECT passing_count FROM pull_request_statuses")
        .get(),
    ).toEqual({ passing_count: 6 });
  });

  test.each([
    "default",
    "disabled",
    "activity",
    "commit",
    "auto-merge",
  ])("still reactivates for %s updates", async (change) => {
    const now = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.parse(updatedAt) + 1_000);
    await syncGithub(true);
    if (change !== "default") setSetting(ignoreCheckUpdatesSetting, "true");
    if (change === "disabled") setSetting(ignoreCheckUpdatesSetting, undefined);
    dismissPullRequest(true);
    now.mockReturnValue(Date.now() + 1_000);
    livePullRequest.statusCheckRollup.state = "FAILURE";
    if (change === "activity")
      livePullRequest.updatedAt = new Date(Date.now()).toISOString();
    if (change === "commit") livePullRequest.headRefOid = "new-commit";
    if (change === "auto-merge") livePullRequest.autoMergeRequest = null;
    await syncGithub(true);
    expect(
      getDatabase()
        .prepare("SELECT status, snoozed_until FROM user_inbox_item_states")
        .get(),
    ).toEqual({ status: "active", snoozed_until: null });
  });

  test("does not repeat unchanged PR or identity hydration", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    await syncGithub(true);
    const revisionAfterFirstSync = githubDataRevision();
    expect(
      getDatabase()
        .prepare("SELECT auto_merge_enabled FROM pull_request_details LIMIT 1")
        .get(),
    ).toEqual({ auto_merge_enabled: 1 });
    expect(
      getDatabase()
        .prepare(
          "SELECT filename, additions, deletions FROM pull_request_files ORDER BY filename",
        )
        .all(),
    ).toEqual([
      { filename: "src/app.test.ts", additions: 0, deletions: 0 },
      { filename: "src/app.ts", additions: 4, deletions: 1 },
    ]);
    const detailRequestsAfterFirstSync = requests.filter((url) =>
      /pulls\/7(?:\/commits|\/files|$)|issues\/7\/timeline/.test(url),
    ).length;
    const identityRequestsAfterFirstSync = requests.filter(
      (url) => url.endsWith("/user") || url.includes("/user/teams?"),
    ).length;

    now.mockReturnValue(2_000);
    await syncGithub(true);

    expect(githubDataRevision()).toBe(revisionAfterFirstSync);
    expect(detailRequestsAfterFirstSync).toBe(4);
    expect(identityRequestsAfterFirstSync).toBe(2);
    expect(
      requests.filter((url) =>
        /pulls\/7(?:\/commits|\/files|$)|issues\/7\/timeline/.test(url),
      ),
    ).toHaveLength(4);
    expect(
      requests.filter(
        (url) => url.endsWith("/user") || url.includes("/user/teams?"),
      ),
    ).toHaveLength(2);
    expect(requests.filter((url) => url.endsWith("/graphql"))).toHaveLength(2);
  });

  test("refreshes one webhook target without listing repositories", async () => {
    await expect(
      syncGithubItem({
        repository: "acme/widgets",
        number: 7,
      }),
    ).resolves.toBe(true);

    expect(
      requests.filter((url) => url.includes("/pulls?state=open")),
    ).toHaveLength(0);
    expect(
      requests.filter((url) =>
        /pulls\/7(?:\/commits|\/files|$)|issues\/7\/timeline/.test(url),
      ),
    ).toHaveLength(4);
    expect(requests.filter((url) => url.endsWith("/graphql"))).toHaveLength(1);
    expect(
      githubWebhookTargets("status", {
        repository: { full_name: "acme/widgets" },
        sha: pullRequest.head.sha,
      }),
    ).toEqual([{ repository: "acme/widgets", number: 7 }]);
  });
});
