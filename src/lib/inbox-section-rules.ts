import type { InboxRow, InboxTimelineItem } from "@/lib/models";

export type InboxGroupId =
  | "ready_to_deploy"
  | "ready_for_action"
  | "yours"
  | "drafts"
  | "other";

type InboxSectionTimelineItem = InboxTimelineItem;

export type InboxSectionRow = Pick<
  InboxRow,
  | "item"
  | "pullRequestDetails"
  | "status"
  | "userState"
  | "approvals"
  | "timeline"
  | "isAuthoredByViewer"
  | "isReviewRequestedFromViewer"
  | "priorityReason"
>;

export const inboxRuleStaleThresholdMs = 3 * 24 * 60 * 60 * 1000;

export function isBot(login: string | undefined) {
  return login?.endsWith("[bot]") ?? false;
}

function hasHumanApproval(row: InboxSectionRow) {
  return row.approvals.some((approval) => !isBot(approval.githubLogin));
}

export function isPromotedToShipIt(row: InboxSectionRow) {
  return Boolean(row.userState?.shipItPromotedAt);
}

function hasOpenChangeRequestFrom(
  row: InboxSectionRow,
  matchesReviewer: (login: string) => boolean,
) {
  const latestByReviewer = new Map<string, InboxSectionTimelineItem>();

  for (const item of row.timeline) {
    if (
      (item.kind === "approved" || item.kind === "changes_requested") &&
      item.actorLogin &&
      matchesReviewer(item.actorLogin)
    ) {
      latestByReviewer.set(item.actorLogin.toLowerCase(), item);
    }
  }

  return Array.from(latestByReviewer.values()).some(
    (item) => item.kind === "changes_requested",
  );
}

export function hasOpenChangeRequest(row: InboxSectionRow) {
  return hasOpenChangeRequestFrom(row, () => true);
}

export function hasOpenBotChangeRequest(row: InboxSectionRow) {
  return hasOpenChangeRequestFrom(row, isBot);
}

function hasPendingChecks(row: InboxSectionRow) {
  return (
    row.status?.rollupState === "pending" || (row.status?.pendingCount ?? 0) > 0
  );
}

function hasFailingChecks(row: InboxSectionRow) {
  return (
    row.status?.rollupState === "failing" || (row.status?.failingCount ?? 0) > 0
  );
}

function isStale(row: InboxSectionRow, now: number) {
  return now - row.item.updatedAt > inboxRuleStaleThresholdMs;
}

function hasChangesAfterViewerReviewReason(row: InboxSectionRow) {
  return row.priorityReason === "changes_after_your_review";
}

function hasStaleWithoutHumanReviewReason(row: InboxSectionRow) {
  return row.priorityReason === "stale_without_human_review";
}

function isNotMineWithNoHumanApproval(row: InboxSectionRow) {
  return !row.isAuthoredByViewer && !hasHumanApproval(row);
}

function isNotMineWithBotRejection(row: InboxSectionRow) {
  return !row.isAuthoredByViewer && hasOpenBotChangeRequest(row);
}

function timelinePosition(item: InboxSectionTimelineItem) {
  return item.order ?? item.occurredAt;
}

function sameLogin(a: string | undefined, b: string | undefined) {
  return a?.toLowerCase() === b?.toLowerCase();
}

export function hasUnansweredHumanComment(row: InboxSectionRow) {
  if (!row.isAuthoredByViewer) return false;

  const latestAuthorActivity = Math.max(
    ...row.timeline
      .filter(
        (item) =>
          item.kind === "commits" ||
          sameLogin(item.actorLogin, row.item.authorLogin),
      )
      .map(timelinePosition),
    0,
  );
  const latestHumanComment = Math.max(
    ...row.timeline
      .filter(
        (item) =>
          item.kind === "commented" &&
          item.actorLogin &&
          !isBot(item.actorLogin) &&
          !sameLogin(item.actorLogin, row.item.authorLogin),
      )
      .map(timelinePosition),
    0,
  );

  return latestHumanComment > latestAuthorActivity;
}

type InboxRuleDefinition = {
  label: string;
  matches: (row: InboxSectionRow, now: number) => boolean;
};

function defineRule(
  label: string,
  matches: InboxRuleDefinition["matches"],
): InboxRuleDefinition {
  return { label, matches };
}

export const inboxRuleCatalog = {
  is_draft: defineRule("It is a draft pull request.", (row) =>
    Boolean(row.pullRequestDetails.draft),
  ),
  has_human_approval: defineRule(
    "It has at least one human approval.",
    hasHumanApproval,
  ),
  promoted_to_ship_it: defineRule(
    "You promoted it to Ship It.",
    isPromotedToShipIt,
  ),
  has_open_change_request: defineRule(
    "Any reviewer still has changes requested.",
    hasOpenChangeRequest,
  ),
  has_pending_checks: defineRule("Any checks are pending.", hasPendingChecks),
  has_failing_checks: defineRule("Any checks are failing.", hasFailingChecks),
  review_requested_from_viewer: defineRule(
    "Review is requested from you.",
    (row) => row.isReviewRequestedFromViewer,
  ),
  has_open_bot_change_request: defineRule(
    "A bot still has changes requested.",
    hasOpenBotChangeRequest,
  ),
  authored_by_viewer: defineRule(
    "You opened it.",
    (row) => row.isAuthoredByViewer,
  ),
  authored_with_open_change_request: defineRule(
    "You opened it and changes are requested.",
    (row) => row.isAuthoredByViewer && hasOpenChangeRequest(row),
  ),
  has_unanswered_human_comment: defineRule(
    "You opened it and a human comment is unanswered.",
    hasUnansweredHumanComment,
  ),
  has_changes_after_viewer_review: defineRule(
    "You requested changes and commits were pushed afterward.",
    hasChangesAfterViewerReviewReason,
  ),
  stale_without_human_review: defineRule(
    "It has gone 3+ days without human review.",
    hasStaleWithoutHumanReviewReason,
  ),
  is_stale: defineRule("It has had no activity for more than 3 days.", isStale),
  not_mine_without_human_approval: defineRule(
    "It has no human approvals and you did not open it.",
    isNotMineWithNoHumanApproval,
  ),
  not_mine_with_bot_rejection: defineRule(
    "A bot still has changes requested and you did not open it.",
    isNotMineWithBotRejection,
  ),
  unmatched: defineRule("It did not match any earlier section.", () => true),
} as const;

export type InboxRuleId = keyof typeof inboxRuleCatalog;

type InboxSectionRule = {
  qualifiers: InboxRuleId[];
  disqualifiers?: InboxRuleId[];
};

export type InboxSectionDefinition = {
  id: InboxGroupId;
  label: string;
  rules: InboxSectionRule[];
};

export const inboxSectionDefinitions: InboxSectionDefinition[] = [
  {
    id: "ready_to_deploy",
    label: "Ship It",
    rules: [
      {
        qualifiers: ["has_human_approval"],
        disqualifiers: [
          "has_open_change_request",
          "has_pending_checks",
          "has_failing_checks",
        ],
      },
      {
        qualifiers: ["promoted_to_ship_it"],
        disqualifiers: [
          "has_open_change_request",
          "has_pending_checks",
          "has_failing_checks",
        ],
      },
    ],
  },
  {
    id: "ready_for_action",
    label: "Ready for action",
    rules: [
      {
        qualifiers: ["review_requested_from_viewer"],
        disqualifiers: ["has_open_bot_change_request", "has_pending_checks"],
      },
      {
        qualifiers: ["authored_with_open_change_request"],
        disqualifiers: ["has_pending_checks"],
      },
      {
        qualifiers: ["has_unanswered_human_comment"],
        disqualifiers: ["has_pending_checks"],
      },
      {
        qualifiers: ["has_changes_after_viewer_review"],
        disqualifiers: ["has_open_bot_change_request", "has_pending_checks"],
      },
      {
        qualifiers: ["stale_without_human_review"],
        disqualifiers: [
          "not_mine_without_human_approval",
          "not_mine_with_bot_rejection",
          "has_pending_checks",
        ],
      },
      {
        qualifiers: ["is_stale"],
        disqualifiers: [
          "not_mine_without_human_approval",
          "not_mine_with_bot_rejection",
          "has_pending_checks",
        ],
      },
    ],
  },
  {
    id: "yours",
    label: "Yours",
    rules: [
      {
        qualifiers: ["authored_by_viewer"],
      },
    ],
  },
  {
    id: "drafts",
    label: "Drafts",
    rules: [
      {
        qualifiers: ["is_draft"],
      },
    ],
  },
  {
    id: "other",
    label: "Not ready for action",
    rules: [
      {
        qualifiers: ["unmatched"],
      },
    ],
  },
];

const inboxSectionClassificationOrder: InboxGroupId[] = [
  "drafts",
  "ready_to_deploy",
  "ready_for_action",
  "yours",
  "other",
];

function matchesRule(
  rule: InboxSectionRule,
  row: InboxSectionRow,
  now: number,
) {
  return (
    rule.qualifiers.every((id) => inboxRuleCatalog[id].matches(row, now)) &&
    !rule.disqualifiers?.some((id) => inboxRuleCatalog[id].matches(row, now))
  );
}

export function classifyInboxSection(
  row: InboxSectionRow,
  now: number,
): InboxGroupId {
  return (
    inboxSectionClassificationOrder.find((sectionId) =>
      inboxSectionDefinitions
        .find((section) => section.id === sectionId)
        ?.rules.some((rule) => matchesRule(rule, row, now)),
    ) ?? "other"
  );
}
