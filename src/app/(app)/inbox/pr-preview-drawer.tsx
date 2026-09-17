import {
  Check,
  CircleDashed,
  CircleDot,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequestArrow,
  History,
  Layers3,
  MessageSquare,
  Rocket,
  StickyNote,
  ThumbsUp,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import {
  classifyInboxSection,
  hasOpenChangeRequest,
  inboxSectionDefinitions,
  isBot,
  nextInboxAction,
} from "@/lib/inbox-section-rules";
import type { InboxRow, InboxTimelineItem } from "@/lib/models";
import { CodexSessionSection } from "./codex-session-section";

type ReviewState = "approved" | "changes_requested";

function reviewStateLabel(state: ReviewState) {
  return state === "approved" ? "Approved" : "Changes requested";
}

function reviewStateStyle(state: ReviewState) {
  return state === "approved"
    ? "pill-success text-[var(--success-text)]"
    : "pill-danger text-[var(--danger-text)]";
}

function checkSummary(status: InboxRow["status"]) {
  if (status?.rollupState === "success") {
    return {
      icon: Check,
      label: "Checks passed",
      style: "text-[var(--success-text)]",
    };
  }
  if (status?.rollupState === "failure" || status?.rollupState === "error") {
    return {
      icon: X,
      label: `${status.failingCount} ${status.failingCount === 1 ? "check" : "checks"} failing`,
      style: "text-[var(--danger-text)]",
    };
  }
  if (status?.rollupState === "pending") {
    return {
      icon: CircleDot,
      label: `${status.pendingCount} ${status.pendingCount === 1 ? "check" : "checks"} pending`,
      style: "text-[var(--warning-text)]",
    };
  }
  return {
    icon: CircleDashed,
    label: "No checks",
    style: "text-foreground/50",
  };
}

function reviewSummary(row: InboxRow) {
  const humanApprovals = row.approvals.filter(
    (approval) => !isBot(approval.githubLogin),
  );

  if (hasOpenChangeRequest(row)) {
    return {
      icon: X,
      label: "Changes requested",
      style: "text-[var(--danger-text)]",
    };
  }
  if (humanApprovals.length) {
    return {
      icon: ThumbsUp,
      label: "Review approved",
      style: "text-[var(--success-text)]",
    };
  }
  if (row.approvals.length) {
    return {
      icon: ThumbsUp,
      label: "Bot review approved",
      style: "text-foreground/60",
    };
  }
  return {
    icon: CircleDashed,
    label: "No review approvals",
    style: "text-[var(--danger-text)]",
  };
}

function reviewers(timeline: InboxTimelineItem[]) {
  const latest = new Map<
    string,
    { login: string; state: ReviewState; occurredAt: number }
  >();

  for (const item of timeline) {
    if (
      !item.actorLogin ||
      (item.kind !== "approved" && item.kind !== "changes_requested")
    ) {
      continue;
    }

    latest.set(item.actorLogin, {
      login: item.actorLogin,
      state: item.kind,
      occurredAt: item.occurredAt,
    });
  }

  return Array.from(latest.values()).sort(
    (a, b) => b.occurredAt - a.occurredAt,
  );
}

function historyLabel(item: InboxTimelineItem) {
  const actor = item.actorLogin ? `@${item.actorLogin}` : "Someone";

  if (item.kind === "opened") return `${actor} opened the pull request`;
  if (item.kind === "approved") return `${actor} approved`;
  if (item.kind === "changes_requested") return `${actor} requested changes`;
  if (item.kind === "commented") return `${actor} commented`;

  const count = item.count ?? 1;
  return `${count} ${count === 1 ? "commit" : "commits"} pushed`;
}

function HistoryIcon({ kind }: { kind: InboxTimelineItem["kind"] }) {
  if (kind === "approved")
    return <Check className="size-3.5 text-[var(--success-text)]" />;
  if (kind === "changes_requested")
    return <X className="size-3.5 text-[var(--danger-text)]" />;
  if (kind === "opened")
    return <GitPullRequestArrow className="size-3.5 text-[var(--info-text)]" />;
  if (kind === "commented")
    return <MessageSquare className="size-3.5 text-[var(--info-text)]" />;
  return <GitCommitHorizontal className="size-3.5 text-foreground/55" />;
}

function dateTime(value: number, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export function PrPreviewDrawer({
  row,
  now,
  timeZone,
  stackOrdinal,
  codexEnabled,
  onClose,
}: {
  row: InboxRow;
  now: number;
  timeZone: string;
  stackOrdinal?: { position: number; total: number };
  codexEnabled: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittedReviews = reviewers(row.timeline);
  const status = row.status;
  const details = row.pullRequestDetails;
  const reviewable = details.reviewableDiff;
  const check = checkSummary(status);
  const review = reviewSummary(row);
  const CheckIcon = check.icon;
  const ReviewIcon = review.icon;
  const section = inboxSectionDefinitions.find(
    ({ id }) => id === classifyInboxSection(row, now),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="pr-preview-title"
      className="h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/45"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className="pr-preview-panel ml-auto flex h-full w-full max-w-xl flex-col border-l border-foreground/10 bg-[var(--surface-bg)] shadow-2xl">
        <header className="border-b border-foreground/10 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-mono text-xs text-foreground/50">
                <GitPullRequestArrow className="size-3.5" />
                {row.repository.fullName}#{row.item.number}
              </p>
              <h2 id="pr-preview-title" className="mt-2">
                <a
                  href={row.item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline text-xl font-semibold leading-snug decoration-foreground/30 underline-offset-4 hover:underline"
                >
                  {row.item.title}
                </a>
              </h2>
              <p className="mt-1 text-sm text-foreground/55">
                Updated {dateTime(row.item.updatedAt, timeZone)} · @
                {row.item.authorLogin}
              </p>
            </div>
            <button
              type="button"
              className="grid size-9 shrink-0 place-items-center rounded-md border border-foreground/10 bg-background/70 text-foreground/65 shadow-sm transition hover:text-foreground"
              aria-label="Close preview"
              onClick={close}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            {section ? (
              <span className="pill-muted inline-flex h-6 items-center rounded px-2 ring-1 ring-foreground/10">
                {section.label}
              </span>
            ) : null}
            {details.autoMergeEnabled ? (
              <span className="inline-flex h-6 items-center gap-1 rounded bg-fuchsia-600 px-2 text-white">
                <Rocket className="size-3" />
                Auto-merge on
              </span>
            ) : null}
            <span className="inline-flex min-h-6 items-center rounded bg-foreground/7 px-2 text-foreground/70 ring-1 ring-foreground/10">
              {nextInboxAction(row, now)}
            </span>
            {row.userState?.snoozedUntil ? (
              <span className="pill-info inline-flex min-h-6 items-center rounded px-2 text-[var(--info-text)] ring-1 ring-sky-500/20">
                Snoozed until {dateTime(row.userState.snoozedUntil, timeZone)}
              </span>
            ) : null}
          </div>
          <dl className="app-inset-surface mt-4 grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 px-3.5 py-3 text-xs leading-5">
            <dt className="text-foreground/45">From</dt>
            <dd
              className="truncate font-mono text-[11px] font-medium text-foreground/75"
              title={details.headRef}
            >
              <GitBranch className="mr-1 inline size-3 text-foreground/40" />
              {details.headRef}
            </dd>
            <dt className="text-foreground/45">Into</dt>
            <dd
              className="truncate font-mono text-[11px] text-foreground/65"
              title={details.baseRef}
            >
              {details.baseRef}
            </dd>
            <dt className="text-foreground/45">Changes</dt>
            <dd className="flex flex-wrap items-center gap-x-2 font-medium tabular-nums text-foreground/70">
              {details.additions !== undefined &&
              details.deletions !== undefined ? (
                <>
                  <span className="font-mono text-[var(--success-text)]">
                    +{details.additions}
                  </span>
                  <span className="font-mono text-[var(--danger-text)]">
                    −{details.deletions}
                  </span>
                  {details.changedFiles !== undefined ? (
                    <span>
                      {details.changedFiles}{" "}
                      {details.changedFiles === 1 ? "file" : "files"}
                    </span>
                  ) : null}
                </>
              ) : (
                "Unknown"
              )}
            </dd>
            {reviewable?.excludedFiles ? (
              <>
                <dt className="text-foreground/45">Reviewable</dt>
                <dd className="flex flex-wrap items-center gap-x-2 font-medium tabular-nums text-foreground/70">
                  <span className="font-mono text-[var(--success-text)]">
                    +{reviewable.additions}
                  </span>
                  <span className="font-mono text-[var(--danger-text)]">
                    −{reviewable.deletions}
                  </span>
                  <span>
                    {reviewable.changedFiles}{" "}
                    {reviewable.changedFiles === 1 ? "file" : "files"}
                  </span>
                  <span className="text-foreground/40">
                    {reviewable.excludedFiles} excluded
                  </span>
                </dd>
              </>
            ) : null}
            {stackOrdinal ? (
              <>
                <dt className="text-foreground/45">Stack</dt>
                <dd className="inline-flex items-center gap-1 font-medium tabular-nums text-foreground/65">
                  <Layers3 className="size-3.5 text-foreground/40" />
                  {stackOrdinal.position} of {stackOrdinal.total}
                </dd>
              </>
            ) : null}
          </dl>
          {row.userState?.note ? (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-sky-500/8 px-3 py-2 text-[13px] leading-5 text-[var(--info-text)] ring-1 ring-sky-500/15">
              <StickyNote className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words font-medium">
                {row.userState.note}
              </span>
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {codexEnabled ? (
            <CodexSessionSection
              key={row.item.id}
              row={row}
              timeZone={timeZone}
            />
          ) : null}

          <section className="mt-7" aria-labelledby="checks-heading">
            <h3 id="checks-heading" className="text-sm font-semibold">
              Checks
            </h3>
            <div className="app-inset-surface mt-3 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${check.style}`}
                >
                  <CheckIcon className="size-4" />
                  {check.label}
                </span>
                <span className="text-xs text-foreground/45">
                  Latest commit
                </span>
              </div>
              {status ? (
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-foreground/8 pt-2.5 text-xs font-medium tabular-nums">
                  <span className="text-[var(--success-text)]">
                    {status.passingCount} passed
                  </span>
                  <span className="text-[var(--warning-text)]">
                    {status.pendingCount} pending
                  </span>
                  <span className="text-[var(--danger-text)]">
                    {status.failingCount} failed
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-7" aria-labelledby="reviewers-heading">
            <h3 id="reviewers-heading" className="text-sm font-semibold">
              Reviewers
            </h3>
            <div className="app-inset-surface mt-3 flex items-center gap-2 px-3.5 py-3">
              <ReviewIcon className={`size-4 shrink-0 ${review.style}`} />
              <span className={`text-sm font-medium ${review.style}`}>
                {review.label}
              </span>
              <span className="ml-auto text-xs text-foreground/45">
                Latest submitted state
              </span>
            </div>
            {submittedReviews.length ? (
              <div className="app-inset-surface mt-2 divide-y divide-foreground/8 overflow-hidden">
                {submittedReviews.map((submittedReview) => (
                  <div
                    key={submittedReview.login}
                    className="flex items-center gap-2.5 px-3.5 py-2.5"
                  >
                    {submittedReview.state === "approved" ? (
                      <Check className="size-3.5 shrink-0 text-[var(--success-text)]" />
                    ) : (
                      <X className="size-3.5 shrink-0 text-[var(--danger-text)]" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      @{submittedReview.login}
                    </span>
                    <time
                      dateTime={new Date(
                        submittedReview.occurredAt,
                      ).toISOString()}
                      className="hidden text-xs text-foreground/40 sm:block"
                    >
                      {dateTime(submittedReview.occurredAt, timeZone)}
                    </time>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${reviewStateStyle(submittedReview.state)}`}
                    >
                      {reviewStateLabel(submittedReview.state)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 px-1 text-sm text-foreground/50">
                No submitted reviews yet.
              </p>
            )}
          </section>

          <section className="mt-7" aria-labelledby="history-heading">
            <div className="flex items-center justify-between gap-3">
              <h3
                id="history-heading"
                className="flex items-center gap-1.5 text-sm font-semibold"
              >
                <History className="size-3.5" />
                History
              </h3>
              <span className="text-xs text-foreground/45">
                {row.timeline.length} events
              </span>
            </div>
            {row.timeline.length ? (
              <ol className="mt-3">
                {row.timeline.map((item, index) => (
                  <li
                    key={`${item.order ?? item.occurredAt}-${item.kind}-${item.actorLogin ?? ""}`}
                    className="relative flex gap-3 pb-4 last:pb-0"
                  >
                    {index < row.timeline.length - 1 ? (
                      <span className="absolute left-4 top-8 h-[calc(100%-1rem)] w-px bg-foreground/10" />
                    ) : null}
                    <span className="app-inset-surface relative z-10 grid size-8 shrink-0 place-items-center rounded-full">
                      <HistoryIcon kind={item.kind} />
                    </span>
                    <div className="min-w-0 pt-1">
                      <p className="text-sm font-medium">
                        {historyLabel(item)}
                      </p>
                      <time
                        dateTime={new Date(item.occurredAt).toISOString()}
                        className="mt-0.5 block text-xs text-foreground/45"
                      >
                        {dateTime(item.occurredAt, timeZone)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="app-inset-surface mt-3 px-3 py-3 text-sm text-foreground/55">
                No activity captured yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </dialog>
  );
}
