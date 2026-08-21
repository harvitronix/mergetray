import { describe, expect, test } from "vitest";
import {
  classifyInboxSection,
  type InboxSectionRow,
  inboxRuleCatalog,
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
