import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { closeDatabase } from "./database.ts";
import {
  syncGithub,
  syncGithubItem,
  upsertSelectedRepository,
} from "./github-sync.ts";
import { githubWebhookTargets } from "./github-webhooks.ts";

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

beforeEach(() => {
  dataDirectory = mkdtempSync(join(tmpdir(), "mergetray-sync-"));
  process.env.MERGETRAY_DATA_DIR = dataDirectory;
  requests = [];
  vi.stubGlobal(
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/graphql")) {
        return Response.json({
          data: {
            p0: {
              id: pullRequest.node_id,
              state: "OPEN",
              updatedAt,
              closedAt: null,
              mergedAt: null,
              headRefOid: pullRequest.head.sha,
              reviewRequests: { nodes: [] },
              reviews: { nodes: [] },
              statusCheckRollup: { state: "SUCCESS", contexts: { nodes: [] } },
            },
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
      if (url.endsWith("/repos/acme/widgets/pulls/7/requested_reviewers")) {
        return Response.json({ users: [], teams: [] });
      }
      if (url.includes("/repos/acme/widgets/pulls/7/reviews?")) {
        return Response.json([], { headers: { etag: '"reviews"' } });
      }
      if (url.includes("/repos/acme/widgets/pulls/7/commits?")) {
        return Response.json([], { headers: { etag: '"commits"' } });
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
  vi.unstubAllGlobals();
  closeDatabase();
  delete process.env.MERGETRAY_DATA_DIR;
  rmSync(dataDirectory, { recursive: true });
});

describe("GitHub polling", () => {
  test("does not hydrate an unchanged PR again", async () => {
    await syncGithub(true);
    const detailRequestsAfterFirstSync = requests.filter((url) =>
      /pulls\/7(?:\/requested_reviewers|\/reviews|\/commits|$)|issues\/7\/timeline/.test(
        url,
      ),
    ).length;

    await syncGithub(true);

    expect(detailRequestsAfterFirstSync).toBe(5);
    expect(
      requests.filter((url) =>
        /pulls\/7(?:\/requested_reviewers|\/reviews|\/commits|$)|issues\/7\/timeline/.test(
          url,
        ),
      ),
    ).toHaveLength(5);
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
        /pulls\/7(?:\/requested_reviewers|\/reviews|\/commits|$)|issues\/7\/timeline/.test(
          url,
        ),
      ),
    ).toHaveLength(5);
    expect(requests.filter((url) => url.endsWith("/graphql"))).toHaveLength(1);
    expect(
      githubWebhookTargets("status", {
        repository: { full_name: "acme/widgets" },
        sha: pullRequest.head.sha,
      }),
    ).toEqual([{ repository: "acme/widgets", number: 7 }]);
  });
});
