"use client";

import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleDot,
  Clock3,
  GitCommitHorizontal,
  GitPullRequestArrow,
  Layers3,
  MessageSquare,
  Minus,
  PanelRightOpen,
  Pencil,
  Rocket,
  RotateCcw,
  StickyNote,
  ThumbsUp,
  X,
} from "lucide-react";
import Image from "next/image";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { codexSessionUrl } from "@/lib/codex-links";
import {
  hasOpenBotChangeRequest,
  hasOpenChangeRequest,
  hasUnansweredHumanComment,
  type InboxGroupId,
  inboxRuleStaleThresholdMs,
  inboxSectionDefinitions,
  isBot,
  isPromotedToShipIt,
} from "@/lib/inbox-section-rules";
import type { InboxRow, InboxTimelineItem } from "@/lib/models";
import { snoozeOptions } from "./inbox-snooze";

const checkStyles = {
  passing: "text-[var(--success-text)]",
  failing: "text-[var(--danger-text)]",
  pending: "text-[var(--warning-text)]",
  unknown: "text-foreground/50",
};

const timelinePreviewCount = 4;

type CheckState = keyof typeof checkStyles;
type SectionView = "active" | "done";

type InboxItemId = InboxRow["item"]["id"];
type StackPosition = "first" | "middle" | "last";

const sectionLabels = Object.fromEntries(
  inboxSectionDefinitions.map((section) => [section.id, section.label]),
) as Record<InboxGroupId, string>;

const sectionIndicatorStyles: Record<
  InboxGroupId,
  { badge: string; rail: string }
> = {
  ready_to_deploy: {
    badge: "pill-success text-[var(--success-text)] ring-emerald-500/20",
    rail: "bg-emerald-500",
  },
  ready_for_action: {
    badge: "pill-warning text-[var(--warning-text)] ring-amber-500/20",
    rail: "bg-amber-500",
  },
  yours: {
    badge: "pill-info text-[var(--info-text)] ring-sky-500/20",
    rail: "bg-sky-500",
  },
  drafts: {
    badge: "bg-violet-500/10 text-foreground/75 ring-violet-500/20",
    rail: "bg-violet-500",
  },
  other: {
    badge: "pill-muted text-foreground/60 ring-foreground/10",
    rail: "bg-foreground/35",
  },
};

const toolbarItemClass =
  "inline-flex h-8 min-w-8 items-center justify-center px-2 text-foreground/70 transition hover:bg-foreground/[0.05] hover:text-foreground disabled:pointer-events-none disabled:opacity-45";

type InboxRowCardProps = {
  row: InboxRow;
  sectionId: InboxGroupId;
  groupView: SectionView;
  visuallyIndicated?: boolean;
  stackPosition?: StackPosition;
  stackOrdinal?: { position: number; total: number };
  now: number;
  timeZone: string;
  isTimelineExpanded: boolean;
  selectionEnabled: boolean;
  isSelected: boolean;
  exitKind?: "done" | "snooze";
  isSnoozeOpen: boolean;
  isNoteOpen: boolean;
  updateStatus: (formData: FormData) => void | Promise<void>;
  snoozeItem: (formData: FormData) => void | Promise<void>;
  promoteToShipIt: (formData: FormData) => void | Promise<void>;
  setUserNote: (formData: FormData) => void | Promise<void>;
  onStatusSubmit: (
    event: FormEvent<HTMLFormElement>,
    inboxItemId: InboxItemId,
  ) => void;
  onSnoozeSubmit: (
    event: FormEvent<HTMLFormElement>,
    inboxItemId: InboxItemId,
  ) => void;
  onShipItSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNoteSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveNoteSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTimeline: (inboxItemId: InboxItemId) => void;
  onToggleSelection: (inboxItemId: InboxItemId) => void;
  onToggleSnooze: (inboxItemId: InboxItemId) => void;
  onToggleNote: (inboxItemId: InboxItemId) => void;
  onPreview: (row: InboxRow) => void;
};

function checkState(value: string | undefined): CheckState {
  if (value === "success") return "passing";
  if (value === "failure") return "failing";
  if (value === "pending") return "pending";
  return "unknown";
}

function dateTimeLabel(label: string, value: number, timeZone: string) {
  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));

  return `${label} ${date}`;
}

function snoozedUntilLabel(value: number, now: number, timeZone: string) {
  const calendarDay = (timestamp: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        timeZone,
      })
        .formatToParts(new Date(timestamp))
        .map((part) => [part.type, part.value]),
    );
    return Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
    );
  };
  const daysAway =
    (calendarDay(value) - calendarDay(now)) / (24 * 60 * 60 * 1000);

  if (daysAway === 0) {
    const time = new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(new Date(value));
    return `Snoozed until ${time}`;
  }
  if (daysAway === 1) return "Snoozed until tomorrow";
  if (daysAway > 1 && daysAway <= 7) {
    const weekday = new Intl.DateTimeFormat("en", {
      weekday: "long",
      timeZone,
    }).format(new Date(value));
    return `Snoozed until ${weekday}`;
  }
  return dateTimeLabel("Snoozed until", value, timeZone);
}

function checksLabel(
  status: {
    failingCount: number;
    pendingCount: number;
    passingCount: number;
  } | null,
  state: CheckState,
) {
  if (!status || state === "unknown") return "No checks";
  if (state === "failing") return `${status.failingCount} failing`;
  if (state === "pending") return `${status.pendingCount} pending`;
  return "Passed";
}

function ChecksIcon({ state }: { state: CheckState }) {
  if (state === "passing") return <Check className="size-3.5" />;
  if (state === "failing") return <X className="size-3.5" />;
  if (state === "pending") return <CircleDot className="size-3.5" />;
  return <Minus className="size-3.5" />;
}

function timelineStyle(kind: InboxTimelineItem["kind"]) {
  if (kind === "changes_requested") {
    return "rounded bg-red-500/10 px-1.5 text-[var(--danger-text)]";
  }
  if (kind === "approved") {
    return "px-1 text-[var(--success-text)]";
  }
  return "px-1 text-foreground/60";
}

function TimelineIcon({ kind }: { kind: InboxTimelineItem["kind"] }) {
  if (kind === "approved") return <Check className="size-3" />;
  if (kind === "changes_requested") return <X className="size-3" />;
  if (kind === "opened") return <GitPullRequestArrow className="size-3" />;
  if (kind === "commented") return <MessageSquare className="size-3" />;
  return <GitCommitHorizontal className="size-3" />;
}

function timelineLabel(item: InboxTimelineItem) {
  if (item.kind === "opened") return "Opened";
  if (item.kind === "commits") {
    const count = item.count ?? 1;
    return `${count} ${count === 1 ? "commit" : "commits"}`;
  }

  if (item.kind === "commented") {
    return item.actorLogin ? `@${item.actorLogin}` : "Comment";
  }

  if (item.kind === "approved" || item.kind === "changes_requested") {
    return item.actorLogin ? `@${item.actorLogin}` : "Review";
  }
}

function dayCountLabel(value: number) {
  const days = Math.max(1, Math.floor(value / (24 * 60 * 60 * 1000)));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function readyForActionLabel(row: InboxRow, now: number) {
  if (row.isReviewRequestedFromViewer && !hasOpenBotChangeRequest(row)) {
    return "Review requested from you";
  }
  if (row.isAuthoredByViewer && hasOpenChangeRequest(row)) {
    return "Changes requested";
  }
  if (hasUnansweredHumanComment(row)) {
    return "Unanswered human comment";
  }
  if (row.priorityReason === "changes_after_your_review") {
    return "Commits after your review";
  }
  if (row.priorityReason === "stale_without_human_review") {
    const openedAt = row.timeline.find(
      (item) => item.kind === "opened",
    )?.occurredAt;
    return `${dayCountLabel(now - (openedAt ?? row.item.updatedAt))} without human review`;
  }
  if (now - row.item.updatedAt > inboxRuleStaleThresholdMs) {
    return `${dayCountLabel(now - row.item.updatedAt)} without activity`;
  }
}

function reviewBadge(row: InboxRow) {
  const humanApprovals = row.approvals.filter(
    (approval) => !isBot(approval.githubLogin),
  );

  if (hasOpenChangeRequest(row)) {
    return {
      icon: <X className="size-3.5" />,
      label: "Changes requested",
      style: "text-[var(--danger-text)]",
    };
  }

  if (humanApprovals.length) {
    return {
      icon: <ThumbsUp className="size-3.5" />,
      label: "Approved",
      reviewers: humanApprovals
        .map((approval) => `@${approval.githubLogin}`)
        .join(", "),
      style: "text-[var(--success-text)]",
    };
  }

  if (row.approvals.length) {
    return {
      icon: <ThumbsUp className="size-3.5" />,
      label: "Bot approved",
      reviewers: row.approvals
        .map((approval) => `@${approval.githubLogin}`)
        .join(", "),
      style: "text-foreground/60",
    };
  }

  return {
    icon: <CircleDashed className="size-3.5" />,
    label: "No approvals",
    style: "text-[var(--danger-text)]",
  };
}

function Dot() {
  return (
    <span aria-hidden="true" className="mx-1.5 text-foreground/30">
      ·
    </span>
  );
}

function StatusRow({
  label,
  className,
  icon,
  children,
  detail,
}: {
  label: string;
  className: string;
  icon: ReactNode;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <>
      <dt className="text-foreground/50">{label}</dt>
      <dd className="min-w-0">
        <span
          className={`inline-flex max-w-full items-center gap-1.5 font-medium ${className}`}
        >
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{children}</span>
        </span>
        {detail ? (
          <span className="block truncate text-xs text-foreground/50">
            {detail}
          </span>
        ) : null}
      </dd>
    </>
  );
}

export function InboxRowCard({
  row,
  sectionId,
  groupView,
  visuallyIndicated = false,
  stackPosition,
  stackOrdinal,
  now,
  timeZone,
  isTimelineExpanded,
  selectionEnabled,
  isSelected,
  exitKind,
  isSnoozeOpen,
  isNoteOpen,
  updateStatus,
  snoozeItem,
  promoteToShipIt,
  setUserNote,
  onStatusSubmit,
  onSnoozeSubmit,
  onShipItSubmit,
  onNoteSubmit,
  onRemoveNoteSubmit,
  onToggleTimeline,
  onToggleSelection,
  onToggleSnooze,
  onToggleNote,
  onPreview,
}: InboxRowCardProps) {
  const { item, pullRequestDetails, repository, status, timeline } = row;
  const state = checkState(status?.rollupState);
  const actionReason =
    sectionId === "ready_for_action"
      ? readyForActionLabel(row, now)
      : undefined;
  const itemIdentifier = `${repository.fullName}#${item.number}`;
  const review = reviewBadge(row);
  const showActionReason = actionReason && actionReason !== review.label;
  const visibleTimeline =
    !isTimelineExpanded && timeline.length > timelinePreviewCount
      ? timeline.slice(-timelinePreviewCount)
      : timeline;
  const previousTimelineCount = timeline.length - visibleTimeline.length;
  const isExiting = exitKind !== undefined;
  const snoozedUntil = row.userState?.snoozedUntil;
  const note = row.userState?.note;
  const shipItPromoted = isPromotedToShipIt(row);
  const codexLink = row.agentSessionLinks.find(
    (session) => session.provider === "codex",
  );
  const noteInputRef = useRef<HTMLInputElement>(null);
  const snoozeMenuRef = useRef<HTMLDivElement>(null);
  const sectionIndicator = sectionIndicatorStyles[sectionId];
  const hasChangeCounts =
    pullRequestDetails.additions !== undefined &&
    pullRequestDetails.deletions !== undefined;

  useEffect(() => {
    if (isNoteOpen) noteInputRef.current?.focus();
  }, [isNoteOpen]);

  useEffect(() => {
    if (!isSnoozeOpen) return;

    function closeOnClickOutside(event: PointerEvent) {
      if (!snoozeMenuRef.current?.contains(event.target as Node)) {
        onToggleSnooze(item.id);
      }
    }

    document.addEventListener("pointerdown", closeOnClickOutside);
    return () =>
      document.removeEventListener("pointerdown", closeOnClickOutside);
  }, [isSnoozeOpen, item.id, onToggleSnooze]);

  return (
    <article
      className={`inbox-card group relative isolate grid gap-x-6 gap-y-3 py-4 transition lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start ${
        stackPosition ? "pl-10 pr-5" : "px-5"
      } ${
        isExiting ? "inbox-card-done-exit overflow-hidden" : "overflow-visible"
      } ${isSnoozeOpen || isNoteOpen ? "z-30" : ""} ${isSelected ? "bg-foreground/[0.035]" : ""}`}
    >
      {visuallyIndicated ? (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1 ${sectionIndicator.rail}`}
        />
      ) : null}
      {stackPosition ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-3.5 w-3 text-foreground/25"
        >
          {stackPosition !== "first" ? (
            <span className="absolute bottom-1/2 left-1/2 top-0 w-px bg-current" />
          ) : null}
          {stackPosition !== "last" ? (
            <span className="absolute bottom-0 left-1/2 top-1/2 w-px bg-current" />
          ) : null}
          <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface-bg)] bg-current" />
        </span>
      ) : null}
      {isExiting ? (
        <Image
          src={
            exitKind === "snooze"
              ? "/mascot-snooze.png"
              : "/mergetray-mascot-card.png"
          }
          alt=""
          width={exitKind === "snooze" ? 1402 : 1024}
          height={exitKind === "snooze" ? 1122 : 1024}
          aria-hidden="true"
          className="inbox-done-mascot pointer-events-none absolute bottom-0 right-0 z-20 w-48 select-none sm:w-56"
          priority
          unoptimized
        />
      ) : null}
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-3">
          {groupView === "active" && selectionEnabled ? (
            <input
              type="checkbox"
              className={`mt-1 size-4 shrink-0 cursor-pointer accent-[var(--selected-control-bg)] transition-opacity ${
                isSelected
                  ? "opacity-100"
                  : "opacity-35 group-hover:opacity-100 group-focus-within:opacity-100"
              }`}
              checked={isSelected}
              disabled={isExiting}
              aria-label={`Select pull request ${itemIdentifier}`}
              onChange={() => onToggleSelection(item.id)}
            />
          ) : null}
          <div className="grid min-w-0 flex-1 gap-2.5">
            <div className="min-w-0">
              {visuallyIndicated ||
              pullRequestDetails.autoMergeEnabled ||
              showActionReason ||
              (groupView === "done" && snoozedUntil) ? (
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {visuallyIndicated ? (
                    <span
                      className={`inline-flex h-5 items-center gap-1.5 rounded px-2 text-[11px] font-semibold ring-1 ${sectionIndicator.badge}`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${sectionIndicator.rail}`}
                      />
                      {sectionLabels[sectionId]}
                    </span>
                  ) : null}
                  {pullRequestDetails.autoMergeEnabled ? (
                    <span className="inline-flex h-5 items-center gap-1 rounded bg-fuchsia-600 px-2 text-[11px] font-semibold text-white">
                      <Rocket className="size-3" />
                      Auto-merge on
                    </span>
                  ) : null}
                  {showActionReason ? (
                    <span className="pill-warning inline-flex h-5 items-center gap-1.5 rounded px-2 text-[11px] font-semibold text-[var(--warning-text)] ring-1 ring-amber-500/20">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      {actionReason}
                    </span>
                  ) : null}
                  {groupView === "done" && snoozedUntil ? (
                    <span className="inline-flex h-5 items-center gap-1 rounded bg-sky-500/10 px-2 text-[11px] font-semibold text-[var(--info-text)] ring-1 ring-sky-500/20">
                      <Clock3 className="size-3" />
                      {snoozedUntilLabel(snoozedUntil, now, timeZone)}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                title={item.title}
                className="block truncate py-0.5 text-[17px] font-semibold leading-6 tracking-[-0.01em] hover:underline"
              >
                {item.title}
              </a>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center text-[13px] leading-5 text-foreground/55">
                <span className="truncate text-foreground/75">
                  {repository.fullName}
                </span>
                <Dot />
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tabular-nums hover:text-foreground hover:underline"
                >
                  #{item.number}
                </a>
                <Dot />
                <span
                  className={
                    row.isAuthoredByViewer
                      ? "font-medium text-foreground/80"
                      : undefined
                  }
                >
                  @{item.authorLogin}
                </span>
                <Dot />
                <span>
                  {dateTimeLabel("Updated", item.updatedAt, timeZone)}
                </span>
              </div>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-5 text-foreground/55">
                <span
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-mono"
                  title={`${pullRequestDetails.baseRef} ← ${pullRequestDetails.headRef}`}
                >
                  <span className="truncate">{pullRequestDetails.baseRef}</span>
                  <span className="shrink-0 text-foreground/35">←</span>
                  <span className="truncate text-foreground/80">
                    {pullRequestDetails.headRef}
                  </span>
                </span>
                <span className="inline-flex items-center whitespace-nowrap">
                  {hasChangeCounts ? (
                    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                      <span className="text-[var(--success-text)]">
                        +{pullRequestDetails.additions}
                      </span>
                      <span className="text-[var(--danger-text)]">
                        −{pullRequestDetails.deletions}
                      </span>
                    </span>
                  ) : (
                    <span>Changes unknown</span>
                  )}
                  {pullRequestDetails.changedFiles !== undefined ? (
                    <>
                      <Dot />
                      <span className="tabular-nums">
                        {pullRequestDetails.changedFiles}{" "}
                        {pullRequestDetails.changedFiles === 1
                          ? "file"
                          : "files"}
                      </span>
                    </>
                  ) : null}
                  {stackOrdinal ? (
                    <>
                      <Dot />
                      <span
                        className="inline-flex items-center gap-1 tabular-nums"
                        title={`Stack position ${stackOrdinal.position} of ${stackOrdinal.total}`}
                      >
                        <Layers3 className="size-3.5 text-foreground/45" />
                        {stackOrdinal.position} of {stackOrdinal.total}
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
            {timeline.length ? (
              <div
                className={`flex min-w-0 items-center gap-0.5 border-t border-foreground/8 pt-2 text-xs leading-5 ${
                  isTimelineExpanded
                    ? "flex-wrap gap-y-1"
                    : "flex-nowrap overflow-hidden"
                }`}
              >
                {previousTimelineCount > 0 || isTimelineExpanded ? (
                  <button
                    type="button"
                    className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded px-1.5 font-medium text-foreground/70 transition hover:bg-foreground/[0.05] hover:text-foreground"
                    onClick={() => onToggleTimeline(item.id)}
                  >
                    {isTimelineExpanded
                      ? "Show less"
                      : `${previousTimelineCount} previous`}
                    <ChevronDown
                      className={`size-3 text-foreground/45 transition ${
                        isTimelineExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                ) : null}
                {visibleTimeline.map((entry, index) => (
                  <span
                    key={`${entry.order ?? entry.occurredAt}-${entry.kind}-${entry.actorLogin ?? ""}`}
                    className="inline-flex min-w-0 items-center gap-0.5"
                  >
                    {index > 0 || previousTimelineCount > 0 ? (
                      <ChevronRight className="size-3 shrink-0 text-foreground/25" />
                    ) : null}
                    <span
                      className={`inline-flex h-6 min-w-0 items-center gap-1 ${timelineStyle(entry.kind)}`}
                    >
                      <span className="shrink-0 opacity-70">
                        <TimelineIcon kind={entry.kind} />
                      </span>
                      <span className="truncate">{timelineLabel(entry)}</span>
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
            {note ? (
              <form
                action={setUserNote}
                onSubmit={onRemoveNoteSubmit}
                className="flex max-w-2xl items-start gap-2 rounded-md bg-sky-500/8 px-3 py-2 text-[13px] leading-5 text-[var(--info-text)] ring-1 ring-sky-500/15"
              >
                <input type="hidden" name="inboxItemId" value={item.id} />
                <input type="hidden" name="note" value="" />
                <StickyNote className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 flex-1 break-words font-medium">
                  {note}
                </span>
                <button
                  type="submit"
                  className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-sky-500/40 bg-background/40 text-[var(--info-text)] transition hover:bg-sky-500/15"
                  aria-label="Mark note done"
                >
                  <Check className="size-3" />
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-between gap-4 self-stretch">
        <dl
          aria-label="Pull request status"
          className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 text-[13px] leading-6"
        >
          <StatusRow
            label="Checks"
            className={checkStyles[state]}
            icon={<ChecksIcon state={state} />}
          >
            {checksLabel(status, state)}
          </StatusRow>
          <StatusRow
            label="Review"
            className={review.style}
            icon={review.icon}
            detail={review.reviewers}
          >
            {review.label}
          </StatusRow>
        </dl>
        <div
          ref={snoozeMenuRef}
          className="relative flex flex-wrap items-center justify-end gap-2"
        >
          <div className="relative z-30 inline-flex h-8 items-stretch divide-x divide-foreground/10 overflow-hidden rounded-md border border-foreground/12 bg-background/85 shadow-sm">
            {codexLink ? (
              <a
                href={codexSessionUrl(codexLink.sessionId)}
                className={`${toolbarItemClass} text-[var(--info-text)] hover:text-[var(--info-text)]`}
                aria-label="Open linked Codex task"
                title="Open linked Codex task"
              >
                <Bot className="size-3.5" />
              </a>
            ) : null}
            <button
              type="button"
              className={`${toolbarItemClass} relative`}
              disabled={isExiting}
              aria-haspopup="dialog"
              aria-label={
                row.agentSessionCandidates.length
                  ? `Preview pull request and ${row.agentSessionCandidates.length} suggested Codex ${row.agentSessionCandidates.length === 1 ? "task" : "tasks"}`
                  : "Preview pull request"
              }
              title={
                row.agentSessionCandidates.length
                  ? `${row.agentSessionCandidates.length} suggested Codex ${row.agentSessionCandidates.length === 1 ? "task" : "tasks"}`
                  : "Preview pull request"
              }
              onClick={() => onPreview(row)}
            >
              <PanelRightOpen className="size-3.5" />
              {!codexLink && row.agentSessionCandidates.length ? (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-sky-500" />
              ) : null}
            </button>
            <button
              type="button"
              className={toolbarItemClass}
              disabled={isExiting}
              aria-expanded={isNoteOpen}
              aria-label={note ? "Edit note" : "Add note"}
              title={note ? "Edit Note" : "Add Note"}
              onClick={() => onToggleNote(item.id)}
            >
              <Pencil className="size-3.5" />
            </button>
            {groupView === "active" ? (
              <form
                action={promoteToShipIt}
                onSubmit={onShipItSubmit}
                className="contents"
              >
                <input type="hidden" name="inboxItemId" value={item.id} />
                <input
                  type="hidden"
                  name="promoted"
                  value={shipItPromoted ? "false" : "true"}
                />
                <button
                  type="submit"
                  className={`${toolbarItemClass} ${
                    shipItPromoted
                      ? "bg-emerald-500/12 text-[var(--success-text)] hover:bg-emerald-500/18 hover:text-[var(--success-text)]"
                      : ""
                  }`}
                  disabled={isExiting}
                  aria-label={shipItPromoted ? "Unship" : "Ship It"}
                  aria-pressed={shipItPromoted}
                  title={shipItPromoted ? "Unship" : "Ship It"}
                >
                  <Rocket className="size-3.5" />
                </button>
              </form>
            ) : null}
            {groupView === "active" ? (
              <button
                type="button"
                className={`${toolbarItemClass} gap-0.5`}
                disabled={isExiting}
                aria-expanded={isSnoozeOpen}
                aria-label="Snooze"
                title="Snooze"
                onClick={() => onToggleSnooze(item.id)}
              >
                <Clock3 className="size-3.5" />
                <ChevronDown className="size-3 text-foreground/45" />
              </button>
            ) : null}
          </div>
          {isNoteOpen ? (
            <form
              action={setUserNote}
              onSubmit={onNoteSubmit}
              className="absolute right-0 top-10 z-40 grid w-72 gap-2 rounded-lg border border-foreground/10 bg-background p-2 shadow-xl"
            >
              <input type="hidden" name="inboxItemId" value={item.id} />
              <input
                ref={noteInputRef}
                name="note"
                defaultValue={note}
                maxLength={160}
                autoComplete="off"
                placeholder="waiting for Cypress"
                className="h-9 rounded-md border border-foreground/10 bg-transparent px-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--selected-control-bg)] px-2.5 text-xs font-semibold text-[var(--selected-control-fg)]"
              >
                {note ? "Save note" : "Add note"}
              </button>
            </form>
          ) : null}
          {isSnoozeOpen ? (
            <div className="absolute right-0 top-10 z-40 w-40 overflow-hidden rounded-lg border border-foreground/10 bg-background shadow-xl">
              {snoozeOptions.map((option) => (
                <form
                  key={option.value}
                  action={snoozeItem}
                  onSubmit={(event) => onSnoozeSubmit(event, item.id)}
                >
                  <input type="hidden" name="inboxItemId" value={item.id} />
                  <input type="hidden" name="duration" value={option.value} />
                  <button
                    type="submit"
                    className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs font-medium hover:bg-foreground/[0.05]"
                  >
                    <Clock3 className="size-3.5 text-foreground/45" />
                    {option.label}
                  </button>
                </form>
              ))}
            </div>
          ) : null}
          <form
            action={updateStatus}
            onSubmit={(event) => onStatusSubmit(event, item.id)}
          >
            <input
              type="hidden"
              name="status"
              value={groupView === "done" ? "active" : "done"}
            />
            <input type="hidden" name="inboxItemId" value={item.id} />
            <button
              type="submit"
              className="relative z-30 inline-flex h-8 items-center gap-1.5 rounded-md border border-foreground/10 bg-[var(--selected-control-bg)] px-3 text-xs font-semibold text-[var(--selected-control-fg)] shadow-sm hover:opacity-90 disabled:opacity-60"
              disabled={isExiting}
            >
              {groupView === "done" ? (
                <RotateCcw className="size-3" />
              ) : (
                <Check className="size-3" />
              )}
              {groupView === "done" ? "Active" : "Done"}
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
