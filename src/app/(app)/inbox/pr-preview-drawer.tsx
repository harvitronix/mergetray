import {
  Check,
  CircleDot,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequestArrow,
  History,
  MessageSquare,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
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

function changesLabel(row: InboxRow) {
  const details = row.pullRequestDetails;
  if (details.additions === undefined || details.deletions === undefined) {
    return "Changes unknown";
  }

  const files =
    details.changedFiles === undefined
      ? ""
      : ` · ${details.changedFiles} files`;
  return `+${details.additions} / -${details.deletions}${files}`;
}

export function PrPreviewDrawer({
  row,
  timeZone,
  codexEnabled,
  onClose,
}: {
  row: InboxRow;
  timeZone: string;
  codexEnabled: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittedReviews = reviewers(row.timeline);
  const status = row.status;

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
              <h2
                id="pr-preview-title"
                className="mt-2 text-xl font-semibold leading-snug"
              >
                {row.item.title}
              </h2>
              <p className="mt-1 text-sm text-foreground/55">
                Opened by @{row.item.authorLogin}
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
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="pill-muted inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-foreground/10 px-2.5">
              <GitBranch className="size-3 shrink-0" />
              <span className="shrink-0">{row.pullRequestDetails.baseRef}</span>
              <span aria-hidden="true" className="shrink-0">
                ←
              </span>
              <span
                className="min-w-0 max-w-[220px] truncate"
                title={row.pullRequestDetails.headRef}
              >
                {row.pullRequestDetails.headRef}
              </span>
            </span>
            <span className="pill-muted inline-flex h-7 items-center rounded-full border border-foreground/10 px-2.5 font-mono">
              {changesLabel(row)}
            </span>
            <a
              href={row.item.url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--selected-control-bg)] px-3 font-semibold text-[var(--selected-control-fg)]"
            >
              Open on GitHub
              <ExternalLink className="size-3" />
            </a>
          </div>
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
            <div className="flex items-center justify-between gap-3">
              <h3 id="checks-heading" className="text-sm font-semibold">
                Checks
              </h3>
              <span className="text-xs text-foreground/45">Latest commit</span>
            </div>
            {status &&
            status.failingCount + status.pendingCount + status.passingCount >
              0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="pill-success rounded-lg px-3 py-3 text-[var(--success-text)]">
                  <Check className="size-4" />
                  <p className="mt-2 text-2xl font-semibold">
                    {status.passingCount}
                  </p>
                  <p className="text-xs font-medium">Passed</p>
                </div>
                <div className="pill-warning rounded-lg px-3 py-3 text-[var(--warning-text)]">
                  <CircleDot className="size-4" />
                  <p className="mt-2 text-2xl font-semibold">
                    {status.pendingCount}
                  </p>
                  <p className="text-xs font-medium">Pending</p>
                </div>
                <div className="pill-danger rounded-lg px-3 py-3 text-[var(--danger-text)]">
                  <X className="size-4" />
                  <p className="mt-2 text-2xl font-semibold">
                    {status.failingCount}
                  </p>
                  <p className="text-xs font-medium">Failed</p>
                </div>
              </div>
            ) : (
              <p className="app-inset-surface mt-3 px-3 py-3 text-sm text-foreground/55">
                No checks reported for the latest commit.
              </p>
            )}
          </section>

          <section className="mt-7" aria-labelledby="reviewers-heading">
            <div className="flex items-center justify-between gap-3">
              <h3 id="reviewers-heading" className="text-sm font-semibold">
                Reviewers
              </h3>
              <span className="text-xs text-foreground/45">
                Latest submitted state
              </span>
            </div>
            {submittedReviews.length ? (
              <div className="mt-3 grid gap-2">
                {submittedReviews.map((review) => (
                  <div
                    key={review.login}
                    className="app-inset-surface flex items-center gap-3 px-3 py-2.5"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-foreground/8 text-xs font-semibold uppercase">
                      {review.login.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      @{review.login}
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${reviewStateStyle(review.state)}`}
                    >
                      {reviewStateLabel(review.state)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="app-inset-surface mt-3 px-3 py-3 text-sm text-foreground/55">
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
