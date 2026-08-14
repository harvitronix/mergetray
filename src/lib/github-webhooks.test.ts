import { describe, expect, test } from "vitest";
import { githubWebhookTargets } from "./github-webhooks.ts";

describe("GitHub webhook targets", () => {
  test("maps pull request activity to one authoritative refresh", () => {
    expect(
      githubWebhookTargets("pull_request_review", {
        repository: { full_name: "acme/widgets" },
        pull_request: { number: 7 },
      }),
    ).toEqual([{ repository: "acme/widgets", number: 7 }]);
  });

  test("ignores issue comments that are not on pull requests", () => {
    expect(
      githubWebhookTargets("issue_comment", {
        repository: { full_name: "acme/widgets" },
        issue: { number: 8 },
      }),
    ).toEqual([]);
    expect(
      githubWebhookTargets("issue_comment", {
        repository: { full_name: "acme/widgets" },
        issue: { number: 7, pull_request: {} },
      }),
    ).toEqual([{ repository: "acme/widgets", number: 7 }]);
  });

  test("deduplicates check targets", () => {
    expect(
      githubWebhookTargets("check_run", {
        repository: { full_name: "acme/widgets" },
        check_run: { pull_requests: [{ number: 7 }, { number: 7 }] },
      }),
    ).toEqual([{ repository: "acme/widgets", number: 7 }]);
  });
});
