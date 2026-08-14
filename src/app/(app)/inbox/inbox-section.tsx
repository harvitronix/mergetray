"use client";

import {
  CircleAlert,
  Flame,
  GitBranch,
  PencilLine,
  Rocket,
} from "lucide-react";
import type { FormEvent } from "react";
import { Surface } from "@/components/app-ui";
import type {
  InboxGroupId,
  InboxSectionDefinition,
} from "@/lib/inbox-section-rules";
import type { InboxRow } from "@/lib/models";
import { InboxRowCard } from "./inbox-row-card";

type SectionView = "active" | "done";
type InboxItemId = InboxRow["item"]["id"];

const sectionIcons: Partial<Record<InboxGroupId, typeof Rocket>> = {
  ready_to_deploy: Rocket,
  ready_for_action: Flame,
  yours: GitBranch,
  drafts: PencilLine,
  other: CircleAlert,
};

export function isDone(row: InboxRow) {
  return row.item.state !== "open" || row.userState?.status === "done";
}

function sectionViewLabel(view: SectionView) {
  return view === "done" ? "handled" : "active";
}

type InboxSectionProps = {
  section: InboxSectionDefinition;
  rows: InboxRow[];
  groupView: SectionView;
  hiddenRows: Record<string, boolean>;
  expandedRows: Record<string, boolean>;
  exitingRows: Record<string, "done" | "snooze">;
  openSnoozeRow: string | null;
  openNoteRow: string | null;
  now: number;
  timeZone: string;
  selectionEnabled: boolean;
  selectedRowIds: ReadonlySet<InboxItemId>;
  updateStatus: (formData: FormData) => void | Promise<void>;
  snoozeItem: (formData: FormData) => void | Promise<void>;
  promoteToShipIt: (formData: FormData) => void | Promise<void>;
  setUserNote: (formData: FormData) => void | Promise<void>;
  onViewChange: (sectionId: InboxGroupId, view: SectionView) => void;
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
  onToggleGroupSelection: (inboxItemIds: InboxItemId[]) => void;
  onToggleSnooze: (inboxItemId: InboxItemId) => void;
  onToggleNote: (inboxItemId: InboxItemId) => void;
  onPreview: (row: InboxRow) => void;
};

export function InboxSection({
  section,
  rows,
  groupView,
  hiddenRows,
  expandedRows,
  exitingRows,
  openSnoozeRow,
  openNoteRow,
  now,
  timeZone,
  selectionEnabled,
  selectedRowIds,
  updateStatus,
  snoozeItem,
  promoteToShipIt,
  setUserNote,
  onViewChange,
  onStatusSubmit,
  onSnoozeSubmit,
  onShipItSubmit,
  onNoteSubmit,
  onRemoveNoteSubmit,
  onToggleTimeline,
  onToggleSelection,
  onToggleGroupSelection,
  onToggleSnooze,
  onToggleNote,
  onPreview,
}: InboxSectionProps) {
  const activeRows = rows.filter((row) => !isDone(row));
  const doneRows = rows.filter(isDone);
  const snoozedCount = doneRows.filter(
    (row) => row.userState?.snoozedUntil,
  ).length;
  const handledCount = doneRows.length - snoozedCount;
  const sectionRows = (groupView === "done" ? doneRows : activeRows).filter(
    (row) => !hiddenRows[row.item.id],
  );
  const allSectionRowsSelected =
    sectionRows.length > 0 &&
    sectionRows.every((row) => selectedRowIds.has(row.item.id));
  const GroupIcon = sectionIcons[section.id];
  const controlClass = (selected: boolean) =>
    `rounded-md px-2.5 py-1 transition ${
      selected
        ? "bg-[var(--selected-control-bg)] text-[var(--selected-control-fg)] shadow-sm"
        : "text-foreground/60"
    }`;

  return (
    <Surface as="section" className="overflow-visible">
      <div className="inbox-section-header flex flex-col gap-2 rounded-t-lg border-b border-foreground/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          {selectionEnabled && groupView === "active" ? (
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--selected-control-bg)] disabled:cursor-default disabled:opacity-35"
              checked={allSectionRowsSelected}
              disabled={!sectionRows.length}
              aria-label={`Select all items in ${section.label}`}
              onChange={() =>
                onToggleGroupSelection(sectionRows.map((row) => row.item.id))
              }
            />
          ) : null}
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              {GroupIcon ? <GroupIcon className="size-3.5" /> : null}
              {section.label}
            </h2>
            <p className="mt-0.5 text-xs text-foreground/50">
              {activeRows.length} active, {snoozedCount} snoozed, {handledCount}{" "}
              handled
            </p>
          </div>
        </div>
        <div className="inline-flex w-fit rounded-md border border-foreground/10 bg-background/70 p-0.5 text-xs shadow-sm">
          <button
            type="button"
            className={controlClass(groupView === "active")}
            onClick={() => onViewChange(section.id, "active")}
          >
            Active
          </button>
          <button
            type="button"
            className={controlClass(groupView === "done")}
            onClick={() => onViewChange(section.id, "done")}
          >
            Handled
          </button>
        </div>
      </div>
      <div className="divide-y divide-foreground/10">
        {sectionRows.length ? (
          sectionRows.map((row) => (
            <InboxRowCard
              key={row.item.id}
              row={row}
              sectionId={section.id}
              groupView={groupView}
              now={now}
              timeZone={timeZone}
              isTimelineExpanded={expandedRows[row.item.id] ?? false}
              selectionEnabled={selectionEnabled}
              isSelected={selectedRowIds.has(row.item.id)}
              exitKind={
                groupView === "active" ? exitingRows[row.item.id] : undefined
              }
              isSnoozeOpen={openSnoozeRow === row.item.id}
              isNoteOpen={openNoteRow === row.item.id}
              updateStatus={updateStatus}
              snoozeItem={snoozeItem}
              promoteToShipIt={promoteToShipIt}
              setUserNote={setUserNote}
              onStatusSubmit={onStatusSubmit}
              onSnoozeSubmit={onSnoozeSubmit}
              onShipItSubmit={onShipItSubmit}
              onNoteSubmit={onNoteSubmit}
              onRemoveNoteSubmit={onRemoveNoteSubmit}
              onToggleTimeline={onToggleTimeline}
              onToggleSelection={onToggleSelection}
              onToggleSnooze={onToggleSnooze}
              onToggleNote={onToggleNote}
              onPreview={onPreview}
            />
          ))
        ) : (
          <div className="px-4 py-8 text-sm text-foreground/50">
            No {sectionViewLabel(groupView)} items in this section.
          </div>
        )}
      </div>
    </Surface>
  );
}
