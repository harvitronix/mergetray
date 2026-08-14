import { describe, expect, test } from "vitest";
import {
  approvedReviewers,
  type GitHubPullRequest,
  timelineItems,
} from "./github-sync-reducers.ts";

function pullRequest(
  overrides: Partial<GitHubPullRequest> = {},
): GitHubPullRequest {
  return {
    id: 1,
    node_id: "node",
    number: 12,
    title: "Test PR",
    html_url: "https://example.test/pull/12",
    user: { id: 10, login: "author" },
    state: "open",
    created_at: "2026-01-01T00:00:00Z",
    head: { sha: "abc", ref: "feature" },
    base: { ref: "main" },
    updated_at: "2026-01-01T00:00:00Z",
    closed_at: null,
    merged_at: null,
    ...overrides,
  };
}

describe("GitHub sync reducers", () => {
  test("approvedReviewers keeps each reviewer's latest state", () => {
    expect(
      approvedReviewers([
        {
          state: "APPROVED",
          submitted_at: "2026-01-01T01:00:00Z",
          user: { id: 20, login: "sam" },
        },
        {
          state: "CHANGES_REQUESTED",
          submitted_at: "2026-01-01T02:00:00Z",
          user: { id: 20, login: "sam" },
        },
        {
          state: "APPROVED",
          submitted_at: "2026-01-01T03:00:00Z",
          user: { id: 30, login: "lee" },
        },
      ]),
    ).toEqual([{ githubUserId: "30", githubLogin: "lee" }]);
  });

  test("approvedReviewers preserves GraphQL bot identity", () => {
    expect(
      approvedReviewers([
        {
          state: "APPROVED",
          submitted_at: "2026-01-01T01:00:00Z",
          user: { id: 20, login: "coderabbitai", type: "Bot" },
        },
      ]),
    ).toEqual([{ githubUserId: "20", githubLogin: "coderabbitai[bot]" }]);
  });

  test("timelineItems compresses adjacent commits before the next review event", () => {
    expect(
      timelineItems(
        pullRequest(),
        [
          {
            state: "APPROVED",
            submitted_at: "2026-01-01T04:00:00Z",
            user: { id: 30, login: "lee" },
          },
        ],
        [
          { commit: { author: { date: "2026-01-01T02:00:00Z" } } },
          { commit: { author: { date: "2026-01-01T03:00:00Z" } } },
        ],
        [],
      ).map((item) => ({
        kind: item.kind,
        count: item.count,
        actorLogin: item.actorLogin,
        order: item.order,
      })),
    ).toEqual([
      { kind: "opened", count: undefined, actorLogin: "author", order: 0 },
      { kind: "commits", count: 2, actorLogin: undefined, order: 1 },
      { kind: "approved", count: undefined, actorLogin: "lee", order: 2 },
    ]);
  });
});
