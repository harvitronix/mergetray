import { getDatabase } from "./database.ts";
import { type GithubSyncTarget, syncGithubItem } from "./github-sync.ts";

type PullRequestReference = { number?: number };

type GithubWebhookPayload = {
  repository?: { full_name?: string };
  pull_request?: PullRequestReference;
  issue?: PullRequestReference & { pull_request?: unknown };
  check_run?: {
    head_sha?: string;
    pull_requests?: PullRequestReference[];
  };
  check_suite?: {
    head_sha?: string;
    pull_requests?: PullRequestReference[];
  };
  sha?: string;
};

const pullRequestEvents = new Set([
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
]);

function target(repository: string, number: number | undefined) {
  if (number === undefined || !Number.isInteger(number) || number < 1) return;
  return { repository, number };
}

function pullRequestsForHeadSha(repository: string, headSha?: string) {
  if (!headSha) return [];
  return getDatabase()
    .prepare(
      `SELECT i.number
       FROM inbox_items i
       JOIN repositories r ON r.id = i.repository_id
       JOIN pull_request_details d ON d.inbox_item_id = i.id
       WHERE r.full_name = ? AND r.selected = 1 AND r.removed_at IS NULL
         AND d.head_sha = ?`,
    )
    .all(repository, headSha)
    .map((row) => Number((row as { number: number }).number));
}

export function githubWebhookTargets(event: string, value: unknown) {
  if (!value || typeof value !== "object") return [];
  const payload = value as GithubWebhookPayload;
  const repository = payload.repository?.full_name;
  if (!repository) return [];

  if (pullRequestEvents.has(event)) {
    const result = target(repository, payload.pull_request?.number);
    return result ? [result] : [];
  }

  if (event === "issue_comment") {
    if (!payload.issue?.pull_request) return [];
    const result = target(repository, payload.issue.number);
    return result ? [result] : [];
  }

  if (event !== "check_run" && event !== "check_suite" && event !== "status") {
    return [];
  }

  const check = payload.check_run ?? payload.check_suite;
  const numbers = [
    ...(check?.pull_requests?.map((pullRequest) => pullRequest.number) ?? []),
    ...pullRequestsForHeadSha(repository, check?.head_sha ?? payload.sha),
  ];
  return Array.from(new Set(numbers)).flatMap((number) => {
    const result = target(repository, number);
    return result ? [result] : [];
  });
}

const pendingTargets = new Map<string, GithubSyncTarget>();
let pendingSync: Promise<void> | undefined;

export function queueGithubWebhookSync(targets: GithubSyncTarget[]) {
  for (const item of targets) {
    pendingTargets.set(`${item.repository}#${item.number}`, item);
  }

  pendingSync ??= (async () => {
    await new Promise((resolve) => setTimeout(resolve, 750));
    while (pendingTargets.size) {
      const batch = Array.from(pendingTargets.values());
      pendingTargets.clear();
      for (const item of batch) {
        try {
          await syncGithubItem(item);
        } catch (error) {
          console.warn(
            `Webhook refresh failed for ${item.repository}#${item.number}`,
            error,
          );
        }
      }
    }
  })().finally(() => {
    pendingSync = undefined;
  });

  return pendingSync;
}
