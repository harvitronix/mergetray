export type Repository = {
  id: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  archived: boolean;
  removedAt?: number;
};

export type InboxItem = {
  id: string;
  repositoryId: string;
  githubItemId?: number;
  githubNodeId?: string;
  number: number;
  title: string;
  url: string;
  authorGithubUserId?: string;
  authorLogin: string;
  state: "open" | "closed" | "merged";
  updatedAt: number;
  closedAt?: number;
  lastSyncedAt: number;
};

export type PullRequestDetails = {
  id: string;
  inboxItemId: string;
  draft: boolean;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  headSha: string;
  headRef: string;
  baseRef: string;
  mergedAt?: number;
  autoMergeEnabled: boolean;
};

export type PullRequestStatus = {
  id: string;
  inboxItemId: string;
  headSha: string;
  rollupState: string;
  failingCount: number;
  pendingCount: number;
  passingCount: number;
  updatedAt: number;
};

export type UserState = {
  id: string;
  inboxItemId: string;
  status: "active" | "done";
  markedDoneAt?: number;
  snoozedUntil?: number;
  shipItPromotedAt?: number;
  note?: string;
};

export type InboxParticipant = {
  id: string;
  inboxItemId: string;
  githubUserId?: string;
  githubLogin: string;
  githubOrgLogin?: string;
  githubTeamSlug?: string;
  relationship: "approved" | "review_requested";
};

export type InboxTimelineItem = {
  id: string;
  inboxItemId: string;
  kind: "opened" | "commits" | "approved" | "changes_requested" | "commented";
  occurredAt: number;
  actorLogin?: string;
  actorGithubUserId?: string;
  order?: number;
  count?: number;
};

export type AgentSessionProvider = "codex";

export type AgentSessionLink = {
  provider: AgentSessionProvider;
  sessionId: string;
};

export type AgentSession = AgentSessionLink & {
  title: string;
  cwd: string;
  updatedAt: number;
  archived: boolean;
};

export type AgentSessionLookup = {
  link?: AgentSessionLink;
  candidates: AgentSession[];
  error?: string;
  autoLinked: boolean;
};

export type InboxRow = {
  item: InboxItem;
  repository: Repository;
  pullRequestDetails: PullRequestDetails;
  status: PullRequestStatus | null;
  userState: UserState | null;
  isAuthoredByViewer: boolean;
  isRelevantToViewer: boolean;
  isApprovedByViewer: boolean;
  isReviewRequestedFromViewer: boolean;
  approvals: InboxParticipant[];
  timeline: InboxTimelineItem[];
  agentSessionLinks: AgentSessionLink[];
  agentSessionCandidates: AgentSession[];
  priorityReason?: "changes_after_your_review" | "stale_without_human_review";
};
