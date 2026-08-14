export type GitHubPullRequest = {
  id: number;
  node_id: string;
  number: number;
  title: string;
  html_url: string;
  user: { id?: number; login?: string } | null;
  state: string;
  draft?: boolean;
  created_at?: string;
  head: { sha: string; ref: string };
  base: { ref: string };
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
};

export type GitHubReview = {
  state: string;
  submitted_at: string | null;
  user: { id?: number; login?: string; type?: string } | null;
};

export type GitHubCommit = {
  commit?: { author?: { date?: string | null } };
};

export type GitHubTimelineEvent = {
  event: string;
  submitted_at?: string | null;
  created_at?: string | null;
  state?: string;
  user?: { id?: number; login?: string } | null;
  author?: { date?: string | null };
  committer?: { date?: string | null };
  actor?: { id?: number; login?: string } | null;
};

type TimelineItem = {
  kind: "opened" | "commits" | "approved" | "changes_requested" | "commented";
  occurredAt: number;
  actorLogin?: string;
  actorGithubUserId?: string;
  order?: number;
  count?: number;
};

type TimelineEvent =
  | TimelineItem
  | { kind: "commit"; occurredAt: number; order?: number };

function collapseCommitEvents(events: TimelineEvent[]) {
  const items: TimelineItem[] = [];
  let commitCount = 0;
  let commitOccurredAt = 0;
  let commitOrder: number | undefined;

  const flushCommits = () => {
    if (!commitCount) return;
    items.push({
      kind: "commits",
      count: commitCount,
      occurredAt: commitOccurredAt,
      order: commitOrder,
    });
    commitCount = 0;
  };

  for (const event of events) {
    if (event.kind === "commit") {
      commitCount += 1;
      commitOccurredAt = event.occurredAt;
      commitOrder = event.order;
    } else {
      flushCommits();
      items.push(event);
    }
  }

  flushCommits();
  return items;
}

export function timestamp(value: string | null | undefined) {
  return value ? Date.parse(value) : undefined;
}

function activityTimestamp(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const parsed = timestamp(value);
    if (parsed !== undefined && !Number.isNaN(parsed)) return parsed;
  }

  return Date.now();
}

export function prState(pr: GitHubPullRequest) {
  if (pr.merged_at) return "merged" as const;
  if (pr.state === "closed") return "closed" as const;
  return "open" as const;
}

export function approvedReviewers(reviews: GitHubReview[]) {
  const latest = new Map<string, GitHubReview>();

  for (const review of reviews) {
    if (review.state !== "APPROVED" && review.state !== "CHANGES_REQUESTED") {
      continue;
    }

    const login = reviewLogin(review);
    if (!login) continue;

    const current = latest.get(login);
    if (
      !current ||
      Date.parse(review.submitted_at ?? "") >
        Date.parse(current.submitted_at ?? "")
    ) {
      latest.set(login, review);
    }
  }

  return Array.from(latest.values()).flatMap((review) => {
    const login = reviewLogin(review);
    if (review.state !== "APPROVED" || !login) return [];
    return [
      {
        githubUserId: review.user?.id ? String(review.user.id) : undefined,
        githubLogin: login,
      },
    ];
  });
}

function reviewLogin(review: GitHubReview) {
  const login = review.user?.login;
  return login && review.user?.type === "Bot" && !login.endsWith("[bot]")
    ? `${login}[bot]`
    : login;
}

export function timelineItems(
  pr: GitHubPullRequest,
  reviews: GitHubReview[],
  commits: GitHubCommit[],
  timeline: GitHubTimelineEvent[],
) {
  const openedAt = activityTimestamp(pr.created_at, pr.updated_at);
  if (timeline.length) {
    return timelineItemsFromGitHubTimeline(pr, timeline, openedAt);
  }

  const events: Array<TimelineItem | { kind: "commit"; occurredAt: number }> = [
    {
      kind: "opened",
      actorLogin: pr.user?.login,
      actorGithubUserId: pr.user?.id ? String(pr.user.id) : undefined,
      occurredAt: openedAt,
      order: 0,
    },
  ];

  for (const commit of commits) {
    events.push({
      kind: "commit",
      occurredAt: Math.max(
        activityTimestamp(commit.commit?.author?.date),
        openedAt + 1,
      ),
    });
  }

  for (const review of reviews) {
    if (
      review.state !== "APPROVED" &&
      review.state !== "CHANGES_REQUESTED" &&
      review.state !== "COMMENTED"
    ) {
      continue;
    }

    events.push({
      kind:
        review.state === "APPROVED"
          ? "approved"
          : review.state === "CHANGES_REQUESTED"
            ? "changes_requested"
            : "commented",
      actorLogin: reviewLogin(review),
      actorGithubUserId: review.user?.id ? String(review.user.id) : undefined,
      occurredAt: activityTimestamp(review.submitted_at),
    });
  }

  events.sort((a, b) => a.occurredAt - b.occurredAt);

  return collapseCommitEvents(events).map((item, order) => ({
    ...item,
    order,
  }));
}

function timelineItemsFromGitHubTimeline(
  pr: GitHubPullRequest,
  timeline: GitHubTimelineEvent[],
  openedAt: number,
) {
  const events: Array<
    TimelineItem | { kind: "commit"; occurredAt: number; order: number }
  > = [
    {
      kind: "opened",
      actorLogin: pr.user?.login,
      actorGithubUserId: pr.user?.id ? String(pr.user.id) : undefined,
      occurredAt: openedAt,
      order: 0,
    },
  ];

  timeline.forEach((event, index) => {
    const order = index + 1;
    if (event.event === "committed") {
      events.push({
        kind: "commit",
        occurredAt: activityTimestamp(
          event.committer?.date ?? event.author?.date,
          event.created_at,
          new Date(openedAt + order).toISOString(),
        ),
        order,
      });
      return;
    }

    if (
      event.event === "reviewed" &&
      (event.state === "approved" ||
        event.state === "changes_requested" ||
        event.state === "commented")
    ) {
      events.push({
        kind:
          event.state === "approved"
            ? "approved"
            : event.state === "changes_requested"
              ? "changes_requested"
              : "commented",
        actorLogin: event.user?.login,
        actorGithubUserId: event.user?.id ? String(event.user.id) : undefined,
        occurredAt: activityTimestamp(event.submitted_at, event.created_at),
        order,
      });
      return;
    }

    if (event.event === "commented") {
      events.push({
        kind: "commented",
        actorLogin: event.user?.login,
        actorGithubUserId: event.user?.id ? String(event.user.id) : undefined,
        occurredAt: activityTimestamp(event.created_at),
        order,
      });
    }
  });

  return collapseCommitEvents(events);
}
