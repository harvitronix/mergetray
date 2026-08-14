"use client";

import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  GitPullRequestArrow,
  MessageSquare,
  PanelRightOpen,
  Pencil,
  Rocket,
  RotateCcw,
  StickyNote,
  ThumbsUp,
  X,
} from "lucide-react";
import Image from "next/image";
import type { FormEvent } from "react";
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
  passing: "pill-success text-[var(--success-text)] ring-emerald-500/20",
  failing: "pill-danger text-[var(--danger-text)] ring-red-500/20",
  pending: "pill-warning text-[var(--warning-text)] ring-amber-500/20",
  unknown: "pill-muted text-foreground/60 ring-foreground/10",
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

type InboxRowCardProps = {
  row: InboxRow;
  sectionId: InboxGroupId;
  groupView: SectionView;
  visuallyIndicated?: boolean;
  stackPosition?: StackPosition;
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
  if (value === "passing" || value === "failing" || value === "pending") {
    return value;
  }
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
  return `${status.passingCount} passing`;
}

function ChecksIcon({ state }: { state: CheckState }) {
  if (state === "passing") return <Check className="size-3" />;
  if (state === "failing") return <X className="size-3" />;
  if (state === "pending") return <CircleDot className="size-3" />;
  return null;
}

function timelineStyle(kind: InboxTimelineItem["kind"]) {
  if (kind === "approved") {
    return "pill-success text-[var(--success-text)]";
  }
  if (kind === "changes_requested") {
    return "pill-danger text-[var(--danger-text)]";
  }
  if (kind === "opened") {
    return "pill-info text-sky-700";
  }
  if (kind === "commented") {
    return "pill-info text-blue-700";
  }
  return "pill-muted text-foreground/65";
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

function changeLabel(pullRequest: {
  additions?: number;
  deletions?: number;
  changedFiles?: number;
}) {
  if (
    pullRequest.additions === undefined ||
    pullRequest.deletions === undefined
  ) {
    return "Changes unknown";
  }

  const files =
    pullRequest.changedFiles === undefined
      ? ""
      : ` in ${pullRequest.changedFiles} files`;

  return `+${pullRequest.additions} / -${pullRequest.deletions}${files}`;
}

function changeStyle(pullRequest: { additions?: number; deletions?: number }) {
  if (
    pullRequest.additions === undefined ||
    pullRequest.deletions === undefined
  ) {
    return "text-foreground/60";
  }

  const total = pullRequest.additions + pullRequest.deletions;
  if (total > 800)
    return "pill-danger text-[var(--danger-text)] ring-red-500/20";
  if (total < 100)
    return "pill-success text-[var(--success-text)] ring-emerald-500/20";
  return "pill-muted text-foreground/60 ring-foreground/10";
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
      icon: <X className="size-3" />,
      label: "Changes requested",
      style: "pill-danger text-[var(--danger-text)] ring-red-500/20",
    };
  }

  if (humanApprovals.length) {
    return {
      icon: <ThumbsUp className="size-3" />,
      label: humanApprovals
        .map((approval) => `@${approval.githubLogin}`)
        .join(", "),
      style: "pill-success text-[var(--success-text)] ring-emerald-500/20",
    };
  }

  if (row.approvals.length) {
    return {
      icon: <ThumbsUp className="size-3" />,
      label: row.approvals
        .map((approval) => `@${approval.githubLogin}`)
        .join(", "),
      style: "pill-muted text-foreground/60 ring-foreground/10",
    };
  }

  if (isPromotedToShipIt(row)) {
    return {
      icon: <Rocket className="size-3" />,
      label: "Promoted",
      style: "pill-success text-[var(--success-text)] ring-emerald-500/20",
    };
  }

  return {
    icon: null,
    label: "No approvals",
    style: "pill-danger text-[var(--danger-text)] ring-red-500/20",
  };
}

export function InboxRowCard({
  row,
  sectionId,
  groupView,
  visuallyIndicated = false,
  stackPosition,
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
  const hideReviewBadge =
    actionReason === "Changes requested" &&
    review.label === "Changes requested";
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
  const sectionIndicator = sectionIndicatorStyles[sectionId];

  useEffect(() => {
    if (isNoteOpen) noteInputRef.current?.focus();
  }, [isNoteOpen]);

  return (
    <article
      className={`inbox-card group relative grid gap-x-4 gap-y-3 py-4 transition md:grid-cols-[minmax(0,1fr)_auto] md:items-start ${
        stackPosition ? "pl-9 pr-4" : "px-4"
      } ${
        isExiting ? "inbox-card-done-exit overflow-hidden" : "overflow-visible"
      } ${isSnoozeOpen ? "z-30" : ""} ${isSelected ? "bg-foreground/[0.035]" : ""}`}
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
          className="absolute inset-y-0 left-3 w-3 text-foreground/25"
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
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {visuallyIndicated ? (
              <span
                className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold ring-1 ${sectionIndicator.badge}`}
              >
                <span
                  className={`size-1.5 rounded-full ${sectionIndicator.rail}`}
                />
                {sectionLabels[sectionId]}
              </span>
            ) : null}
            {hideReviewBadge ? null : (
              <span
                className={`inline-flex h-6 items-center gap-1 rounded-md px-2.5 text-xs font-semibold ring-1 ${review.style}`}
              >
                {review.icon}
                {review.label}
              </span>
            )}
            {actionReason ? (
              <span className="pill-warning inline-flex h-6 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-[var(--warning-text)] ring-1 ring-amber-500/20">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {actionReason}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/55">
            <span className="inline-flex items-center gap-1 font-mono">
              <GitPullRequest className="size-3" />
              {itemIdentifier}
            </span>
            <span>{dateTimeLabel("Updated", item.updatedAt, timeZone)}</span>
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 block truncate text-base font-semibold leading-snug hover:underline sm:text-lg"
          >
            {item.title}
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/60">
            <span className="pill-muted inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-foreground/10 px-2">
              <GitBranch className="size-3 shrink-0" />
              <span className="shrink-0">{pullRequestDetails.baseRef}</span>
              <span aria-hidden="true" className="shrink-0">
                ←
              </span>
              <span
                className="min-w-0 max-w-[220px] truncate"
                title={pullRequestDetails.headRef}
              >
                {pullRequestDetails.headRef}
              </span>
            </span>
            <span className="pill-muted inline-flex h-6 items-center rounded-full border border-foreground/10 px-2">
              By @{item.authorLogin}
            </span>
            <span
              className={`inline-flex h-6 items-center rounded-full px-2 font-mono ring-1 ${changeStyle(pullRequestDetails)}`}
            >
              {changeLabel(pullRequestDetails)}
            </span>
            <span
              className={`inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium ring-1 ${checkStyles[state]}`}
            >
              <ChecksIcon state={state} />
              {checksLabel(status, state)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
        {codexLink ? (
          <a
            href={codexSessionUrl(codexLink.sessionId)}
            className="relative z-30 inline-flex h-8 w-8 items-center justify-center rounded-md border border-sky-500/30 bg-sky-500/10 text-[var(--info-text)] shadow-sm"
            aria-label="Open linked Codex task"
            title="Open linked Codex task"
          >
            <Bot className="size-3.5" />
          </a>
        ) : null}
        <button
          type="button"
          className="relative z-30 inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/12 bg-background/85 text-xs font-semibold shadow-sm disabled:opacity-60"
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
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-sky-500 ring-2 ring-background" />
          ) : null}
        </button>
        <div className="relative">
          <button
            type="button"
            className="relative z-30 inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/12 bg-background/85 text-xs font-semibold shadow-sm disabled:opacity-60"
            disabled={isExiting}
            aria-expanded={isNoteOpen}
            aria-label={note ? "Edit note" : "Add note"}
            title={note ? "Edit Note" : "Add Note"}
            onClick={() => onToggleNote(item.id)}
          >
            <Pencil className="size-3" />
          </button>
          {isNoteOpen ? (
            <form
              action={setUserNote}
              onSubmit={onNoteSubmit}
              className="absolute right-0 top-9 z-40 grid w-72 gap-2 rounded-lg border border-foreground/10 bg-background p-2 shadow-xl"
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
        </div>
        {groupView === "active" ? (
          <form action={promoteToShipIt} onSubmit={onShipItSubmit}>
            <input type="hidden" name="inboxItemId" value={item.id} />
            <input
              type="hidden"
              name="promoted"
              value={shipItPromoted ? "false" : "true"}
            />
            <button
              type="submit"
              className={`relative z-30 inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold shadow-sm disabled:opacity-60 ${
                shipItPromoted
                  ? "border-emerald-500/30 bg-emerald-500/15 text-[var(--success-text)] ring-1 ring-emerald-500/25"
                  : "border-foreground/12 bg-background/85"
              }`}
              disabled={isExiting}
              aria-label={shipItPromoted ? "Unship" : "Ship It"}
              aria-pressed={shipItPromoted}
              title={shipItPromoted ? "Unship" : "Ship It"}
            >
              <Rocket className="size-3" />
            </button>
          </form>
        ) : null}
        {groupView === "active" ? (
          <div className="relative">
            <button
              type="button"
              className="relative z-30 inline-flex h-8 items-center gap-1 rounded-md border border-foreground/12 bg-background/85 px-2.5 text-xs font-semibold shadow-sm disabled:opacity-60"
              disabled={isExiting}
              aria-expanded={isSnoozeOpen}
              aria-label="Snooze"
              title="Snooze"
              onClick={() => onToggleSnooze(item.id)}
            >
              <Clock3 className="size-3" />
              <ChevronDown className="size-3 text-foreground/45" />
            </button>
            {isSnoozeOpen ? (
              <div className="absolute right-0 top-9 z-40 w-36 overflow-hidden rounded-lg border border-foreground/10 bg-background shadow-xl">
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
                      className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs font-medium"
                    >
                      <Clock3 className="size-3.5 text-foreground/45" />
                      {option.label}
                    </button>
                  </form>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {groupView === "done" && snoozedUntil ? (
          <div className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-500/10 px-2.5 text-xs font-medium text-[var(--info-text)] ring-1 ring-sky-500/20">
            <Clock3 className="size-3" />
            {dateTimeLabel("Snoozed until", snoozedUntil, timeZone)}
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
            className="relative z-30 inline-flex h-8 items-center gap-1.5 rounded-md border border-foreground/10 bg-[var(--selected-control-bg)] px-2.5 text-xs font-semibold text-[var(--selected-control-fg)] shadow-sm hover:opacity-90 disabled:opacity-60"
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
      {timeline.length ? (
        <div className="min-w-0 overflow-hidden pt-1 md:col-span-2">
          <div
            className={`flex items-center gap-x-1 gap-y-1.5 text-[11px] ${
              isTimelineExpanded
                ? "flex-wrap"
                : "min-w-0 flex-nowrap overflow-hidden"
            }`}
          >
            {previousTimelineCount > 0 || isTimelineExpanded ? (
              <button
                type="button"
                className="pill-info inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-[11px] font-semibold text-[var(--info-text)]"
                onClick={() => onToggleTimeline(item.id)}
              >
                {isTimelineExpanded
                  ? "Show less"
                  : `${previousTimelineCount} previous`}
                <ChevronDown
                  className={`ml-1 size-3 text-foreground/45 transition ${
                    isTimelineExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>
            ) : null}
            {visibleTimeline.map((item, index) => (
              <span
                key={`${item.order ?? item.occurredAt}-${item.kind}-${item.actorLogin ?? ""}`}
                className="inline-flex min-w-0 items-center gap-0.5"
              >
                {index > 0 || previousTimelineCount > 0 ? (
                  <ChevronRight className="size-2.5 shrink-0 text-foreground/30" />
                ) : null}
                <span
                  className={`inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2.5 font-semibold ${timelineStyle(item.kind)}`}
                >
                  <TimelineIcon kind={item.kind} />
                  <span className="truncate">{timelineLabel(item)}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {note ? (
        <form
          action={setUserNote}
          onSubmit={onRemoveNoteSubmit}
          className="flex max-w-2xl items-start gap-2 rounded-md bg-sky-500/10 px-3 py-2 text-sm font-medium text-[var(--info-text)] ring-1 ring-sky-500/20 md:col-span-2"
        >
          <input type="hidden" name="inboxItemId" value={item.id} />
          <input type="hidden" name="note" value="" />
          <StickyNote className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{note}</span>
          <button
            type="submit"
            className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-sky-500/40 bg-background/40 text-[var(--info-text)] transition hover:bg-sky-500/15"
            aria-label="Mark note done"
          >
            <Check className="size-3" />
          </button>
        </form>
      ) : null}
    </article>
  );
}
