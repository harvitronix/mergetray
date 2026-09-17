"use client";

import {
  Check,
  CircleDot,
  Layers3,
  Minus,
  PanelRightOpen,
  RotateCcw,
  StickyNote,
  ThumbsUp,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import {
  hasOpenChangeRequest,
  type InboxGroupId,
  type InboxSectionDefinition,
  isBot,
  nextInboxAction,
} from "@/lib/inbox-section-rules";
import type { InboxRow } from "@/lib/models";
import { inboxRowView, type SectionView } from "./inbox-section";

type InboxItemId = InboxRow["item"]["id"];

const sectionStyles = {
  ready_to_deploy: "bg-emerald-500",
  ready_for_action: "bg-amber-500",
  yours: "bg-sky-500",
  drafts: "bg-violet-500",
  other: "bg-foreground/35",
};

const sectionOrder: Record<InboxGroupId, number> = {
  drafts: 0,
  other: 1,
  yours: 2,
  ready_for_action: 3,
  ready_to_deploy: 4,
};

function checks(row: InboxRow) {
  const status = row.status;
  if (status?.rollupState === "failure" || status?.rollupState === "error") {
    return {
      icon: X,
      label: `${status.failingCount} failing`,
      style: "text-[var(--danger-text)]",
    };
  }
  if (status?.rollupState === "pending") {
    return {
      icon: CircleDot,
      label: `${status.pendingCount} pending`,
      style: "text-[var(--warning-text)]",
    };
  }
  return status?.rollupState === "success"
    ? {
        icon: Check,
        label: "Checks passed",
        style: "text-[var(--success-text)]",
      }
    : { icon: Minus, label: "No checks", style: "text-foreground/45" };
}

function review(row: InboxRow) {
  if (hasOpenChangeRequest(row)) {
    return {
      icon: X,
      label: "Changes requested",
      style: "text-[var(--danger-text)]",
    };
  }
  if (row.approvals.some((approval) => !isBot(approval.githubLogin))) {
    return {
      icon: ThumbsUp,
      label: "Approved",
      style: "text-[var(--success-text)]",
    };
  }
  return {
    icon: Minus,
    label: "No approval",
    style: "text-foreground/45",
  };
}

function updatedLabel(value: number, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(new Date(value));
}

function KanbanCard({
  row,
  view,
  now,
  timeZone,
  selectionEnabled,
  isSelected,
  isExiting,
  stackOrdinal,
  updateStatus,
  onStatusSubmit,
  onToggleSelection,
  onPreview,
}: {
  row: InboxRow;
  view: SectionView;
  now: number;
  timeZone: string;
  selectionEnabled: boolean;
  isSelected: boolean;
  isExiting: boolean;
  stackOrdinal?: { position: number; total: number };
  updateStatus: (formData: FormData) => void | Promise<void>;
  onStatusSubmit: (
    event: FormEvent<HTMLFormElement>,
    inboxItemId: InboxItemId,
  ) => void;
  onToggleSelection: (inboxItemId: InboxItemId) => void;
  onPreview: (row: InboxRow) => void;
}) {
  const check = checks(row);
  const reviewState = review(row);
  const ChecksIcon = check.icon;
  const ReviewIcon = reviewState.icon;

  return (
    <article
      className={`app-inset-surface inbox-card group relative overflow-hidden transition ${
        isExiting ? "inbox-card-done-exit" : ""
      } ${isSelected ? "ring-2 ring-foreground/25" : ""}`}
    >
      <button
        type="button"
        className="block w-full px-3.5 pb-3 pt-3.5 text-left"
        aria-label={`Preview ${row.repository.fullName} pull request ${row.item.number}`}
        onClick={() => onPreview(row)}
      >
        <span className="flex items-center gap-2 text-[11px] font-medium text-foreground/50">
          <span className="min-w-0 flex-1 truncate">
            {row.repository.fullName}#{row.item.number}
          </span>
          {stackOrdinal ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 tabular-nums"
              title={`Stack position ${stackOrdinal.position} of ${stackOrdinal.total}`}
            >
              <Layers3 className="size-3" />
              {stackOrdinal.position}/{stackOrdinal.total}
            </span>
          ) : null}
          <PanelRightOpen className="size-3.5 shrink-0 opacity-40 transition group-hover:opacity-80" />
        </span>
        <span className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold leading-5">
          {row.item.title}
        </span>
        <span className="mt-2.5 inline-flex max-w-full items-center rounded bg-foreground/7 px-2 py-1 text-[11px] font-semibold leading-4 text-foreground/70">
          <span className="truncate">{nextInboxAction(row, now)}</span>
        </span>
        <span className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-medium">
          <span
            className={`inline-flex min-w-0 items-center gap-1.5 ${check.style}`}
          >
            <ChecksIcon className="size-3.5 shrink-0" />
            <span className="truncate">{check.label}</span>
          </span>
          <span
            className={`inline-flex min-w-0 items-center gap-1.5 ${reviewState.style}`}
          >
            <ReviewIcon className="size-3.5 shrink-0" />
            <span className="truncate">{reviewState.label}</span>
          </span>
        </span>
        {row.userState?.note ? (
          <span className="mt-3 flex items-start gap-1.5 rounded bg-sky-500/8 px-2 py-1.5 text-[11px] leading-4 text-[var(--info-text)]">
            <StickyNote className="mt-0.5 size-3 shrink-0" />
            <span className="line-clamp-2">{row.userState.note}</span>
          </span>
        ) : null}
      </button>
      <div className="flex items-center gap-2 border-t border-foreground/8 px-3.5 py-2.5 text-[11px] text-foreground/45">
        {view === "active" && selectionEnabled ? (
          <input
            type="checkbox"
            className="size-4 shrink-0 cursor-pointer accent-[var(--selected-control-bg)]"
            checked={isSelected}
            disabled={isExiting}
            aria-label={`Select pull request ${row.repository.fullName}#${row.item.number}`}
            onChange={() => onToggleSelection(row.item.id)}
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate">
          @{row.item.authorLogin} · {updatedLabel(row.item.updatedAt, timeZone)}
        </span>
        <form
          action={updateStatus}
          onSubmit={(event) => onStatusSubmit(event, row.item.id)}
        >
          <input
            type="hidden"
            name="status"
            value={view === "active" ? "done" : "active"}
          />
          <input type="hidden" name="inboxItemId" value={row.item.id} />
          <button
            type="submit"
            className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--selected-control-bg)] px-2.5 font-semibold text-[var(--selected-control-fg)] shadow-sm disabled:opacity-60"
            disabled={isExiting}
          >
            {view === "active" ? (
              <Check className="size-3" />
            ) : (
              <RotateCcw className="size-3" />
            )}
            {view === "active" ? "Done" : "Active"}
          </button>
        </form>
      </div>
    </article>
  );
}

export function InboxKanban({
  sections,
  view,
  hiddenRows,
  exitingRows,
  now,
  timeZone,
  selectionEnabled,
  selectedRowIds,
  stackOrdinals,
  updateStatus,
  onStatusSubmit,
  onToggleSelection,
  onToggleGroupSelection,
  onPreview,
}: {
  sections: Array<{ section: InboxSectionDefinition; rows: InboxRow[] }>;
  view: SectionView;
  hiddenRows: Record<string, boolean>;
  exitingRows: Record<string, "done" | "snooze">;
  now: number;
  timeZone: string;
  selectionEnabled: boolean;
  selectedRowIds: ReadonlySet<InboxItemId>;
  stackOrdinals: ReadonlyMap<InboxItemId, { position: number; total: number }>;
  updateStatus: (formData: FormData) => void | Promise<void>;
  onStatusSubmit: (
    event: FormEvent<HTMLFormElement>,
    inboxItemId: InboxItemId,
  ) => void;
  onToggleSelection: (inboxItemId: InboxItemId) => void;
  onToggleGroupSelection: (inboxItemIds: InboxItemId[]) => void;
  onPreview: (row: InboxRow) => void;
}) {
  const visibleSections = sections
    .toSorted((a, b) => sectionOrder[a.section.id] - sectionOrder[b.section.id])
    .map(({ section, rows }) => ({
      section,
      rows: rows.filter(
        (row) =>
          !hiddenRows[row.item.id] &&
          (inboxRowView(row) === view ||
            (view === "active" && exitingRows[row.item.id])),
      ),
    }))
    .filter(({ rows }) => rows.length);

  if (!visibleSections.length) {
    return (
      <div className="rounded-lg border border-dashed border-foreground/12 px-4 py-10 text-center text-sm text-foreground/50">
        No {view === "done" ? "handled" : view} items.
      </div>
    );
  }

  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-3">
      <div className="grid min-w-max grid-flow-col auto-cols-[20rem] items-start gap-3">
        {visibleSections.map(({ section, rows: visibleRows }) => {
          const allSelected = visibleRows.every((row) =>
            selectedRowIds.has(row.item.id),
          );

          return (
            <section key={section.id} className="min-w-0">
              <div className="mb-2 flex items-center gap-2 px-1">
                {view === "active" && selectionEnabled ? (
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 cursor-pointer accent-[var(--selected-control-bg)] disabled:cursor-default disabled:opacity-35"
                    checked={allSelected}
                    disabled={!visibleRows.length}
                    aria-label={`Select all items in ${section.label}`}
                    onChange={() =>
                      onToggleGroupSelection(
                        visibleRows.map((row) => row.item.id),
                      )
                    }
                  />
                ) : null}
                <span
                  className={`size-2 shrink-0 rounded-full ${sectionStyles[section.id]}`}
                />
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {section.label}
                </h2>
                <span className="rounded-full bg-foreground/7 px-2 py-0.5 text-xs tabular-nums text-foreground/55">
                  {visibleRows.length}
                </span>
              </div>
              <div className="grid gap-2.5">
                {visibleRows.map((row) => (
                  <KanbanCard
                    key={row.item.id}
                    row={row}
                    view={view}
                    now={now}
                    timeZone={timeZone}
                    selectionEnabled={selectionEnabled}
                    isSelected={selectedRowIds.has(row.item.id)}
                    isExiting={Boolean(exitingRows[row.item.id])}
                    stackOrdinal={stackOrdinals.get(row.item.id)}
                    updateStatus={updateStatus}
                    onStatusSubmit={onStatusSubmit}
                    onToggleSelection={onToggleSelection}
                    onPreview={onPreview}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
