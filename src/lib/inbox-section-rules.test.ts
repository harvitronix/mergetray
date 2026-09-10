import { describe, expect, test } from "vitest";
import {
  classifyInboxSection,
  type InboxSectionRow,
  inboxRuleCatalog,
  nextInboxAction,
} from "./inbox-section-rules.ts";

const now = Date.UTC(2026, 7, 4);

const pullRequestDetails: NonNullable<InboxSectionRow["pullRequestDetails"]> = {
  id: "1",
  inboxItemId: "1",
  draft: false,
  headSha: "abc",
  headRef: "feature",
  baseRef: "main",
  autoMergeEnabled: false,
};

const baseRow: InboxSectionRow = {
  item: {
    id: "1",
    repositoryId: "1",
    number: 1,
    title: "Test pull request",
    url: "https://example.test/pull/1",
    authorLogin: "author",
    state: "open",
    updatedAt: now,
    lastSyncedAt: now,
  },
  pullRequestDetails,
  status: null,
  userState: null,
  approvals: [],
  timeline: [],
  isAuthoredByViewer: false,
  isReviewRequestedFromViewer: false,
};

function row(overrides: Partial<InboxSectionRow> = {}): InboxSectionRow {
  return { ...baseRow, ...overrides };
}

describe("inbox section rules", () => {
  test("catalog rules carry their human-readable labels", () => {
    expect(inboxRuleCatalog.has_pending_checks.label).toBe(
      "Any checks are pending.",
    );
  });

  test("preserves section priority and disqualifiers", () => {
    const approval = {
      id: "approval",
      inboxItemId: "1",
      githubLogin: "reviewer",
      relationship: "approved" as const,
    };

    expect(classifyInboxSection(row({ approvals: [approval] }), now)).toBe(
      "ready_to_deploy",
    );
    expect(
      classifyInboxSection(
        row({
          approvals: [approval],
          status: {
            id: "status",
            inboxItemId: "1",
            headSha: "abc",
            rollupState: "pending",
            failingCount: 0,
            pendingCount: 1,
            passingCount: 0,
            updatedAt: now,
          },
        }),
        now,
      ),
    ).toBe("other");
    expect(
      classifyInboxSection(
        row({
          approvals: [approval],
          pullRequestDetails: {
            ...pullRequestDetails,
            draft: true,
          },
        }),
        now,
      ),
    ).toBe("drafts");
  });
});

const approval = {
  id: "approval",
  inboxItemId: "1",
  githubLogin: "reviewer",
  relationship: "approved" as const,
};
const changeRequest = {
  id: "review",
  inboxItemId: "1",
  kind: "changes_requested" as const,
  actorLogin: "reviewer",
  occurredAt: now,
};
const passingStatus = {
  id: "status",
  inboxItemId: "1",
  headSha: "abc",
  rollupState: "success",
  failingCount: 0,
  pendingCount: 0,
  passingCount: 1,
  updatedAt: now,
};

describe("next inbox action", () => {
  const cases: [string, Partial<InboxSectionRow>, string, string][] = [
    ["no reviews or checks", {}, "Get a review approval", "Review and approve"],
    [
      "passing checks without approval",
      { status: passingStatus },
      "Get a review approval",
      "Review and approve",
    ],
    [
      "bot-only approval",
      { approvals: [{ ...approval, githubLogin: "reviewer[bot]" }] },
      "Get a review approval",
      "Review and approve",
    ],
    [
      "stale review",
      { priorityReason: "stale_without_human_review" },
      "Follow up for review approval",
      "Review and approve",
    ],
    [
      "stale activity",
      { item: { ...baseRow.item, updatedAt: now - 4 * 86400000 } },
      "Follow up for review approval",
      "Review and approve",
    ],
    [
      "draft with approval",
      {
        pullRequestDetails: { ...pullRequestDetails, draft: true },
        approvals: [approval],
      },
      "Finish draft and request review",
      "Wait for author to finish draft",
    ],
    [
      "ready to merge",
      { approvals: [approval], status: passingStatus },
      "Merge",
      "Merge",
    ],
    [
      "auto-merge ready",
      {
        approvals: [approval],
        pullRequestDetails: { ...pullRequestDetails, autoMergeEnabled: true },
      },
      "Wait for auto-merge",
      "Wait for auto-merge",
    ],
    [
      "manual promotion",
      {
        userState: {
          id: "1",
          inboxItemId: "1",
          status: "active",
          shipItPromotedAt: now,
        },
      },
      "Merge",
      "Merge",
    ],
    [
      "pending checks despite approval",
      {
        approvals: [approval],
        status: { ...passingStatus, rollupState: "pending", pendingCount: 1 },
      },
      "Wait for checks to complete",
      "Wait for checks to complete",
    ],
    [
      "failed checks while others run",
      {
        status: {
          ...passingStatus,
          rollupState: "pending",
          pendingCount: 1,
          failingCount: 1,
        },
      },
      "Address failed checks",
      "Wait for author to fix checks",
    ],
    [
      "review request",
      { isReviewRequestedFromViewer: true },
      "Get a review approval",
      "Review requested from you",
    ],
    [
      "changes requested despite another approval",
      { approvals: [approval], timeline: [changeRequest] },
      "Address requested changes",
      "Wait for author to address feedback",
    ],
    [
      "new commits after viewer requested changes",
      {
        timeline: [changeRequest],
        priorityReason: "changes_after_your_review",
      },
      "Address requested changes",
      "Review new commits",
    ],
    [
      "bot rejection before review request",
      {
        isReviewRequestedFromViewer: true,
        timeline: [{ ...changeRequest, actorLogin: "reviewer[bot]" }],
      },
      "Address requested changes",
      "Wait for author to address feedback",
    ],
    [
      "unanswered comment",
      { timeline: [{ ...changeRequest, kind: "commented" }] },
      "Reply to review comments",
      "Review and approve",
    ],
    [
      "merged despite old failing checks",
      {
        item: { ...baseRow.item, state: "merged" },
        status: { ...passingStatus, rollupState: "failure" },
      },
      "Merged, no action needed",
      "Merged, no action needed",
    ],
    [
      "closed draft",
      {
        item: { ...baseRow.item, state: "closed" },
        pullRequestDetails: { ...pullRequestDetails, draft: true },
      },
      "Closed, no action needed",
      "Closed, no action needed",
    ],
  ];

  test.each(cases)("%s", (_name, overrides, ownAction, otherAction) => {
    expect(
      nextInboxAction(row({ ...overrides, isAuthoredByViewer: true }), now),
    ).toBe(ownAction);
    expect(nextInboxAction(row(overrides), now)).toBe(otherAction);
  });

  test.each([
    "failure",
    "error",
  ])("%s rollup blocks merging even without individual check counts", (rollupState) => {
    const pr = row({
      approvals: [approval],
      status: { ...passingStatus, rollupState },
    });
    expect(classifyInboxSection(pr, now)).toBe("other");
    expect(nextInboxAction(pr, now)).toBe("Wait for author to fix checks");
  });
});
