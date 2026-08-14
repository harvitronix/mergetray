"use client";

import {
  ExternalLink,
  GitPullRequestArrow,
  LayoutGrid,
  List,
  ListChecks,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Notice, Surface } from "@/components/app-ui";
import { type InboxLayout, inboxLayoutCookieName } from "@/lib/inbox-layout";
import {
  classifyInboxSection,
  type InboxGroupId,
  inboxSectionDefinitions,
} from "@/lib/inbox-section-rules";
import { groupInboxRows } from "@/lib/inbox-stacks";
import type { InboxRow } from "@/lib/models";
import { InboxBulkActions } from "./inbox-bulk-actions";
import { InboxRowCard } from "./inbox-row-card";
import { InboxSection, isDone } from "./inbox-section";
import { InboxZeroState } from "./inbox-zero-state";
import { PrPreviewDrawer } from "./pr-preview-drawer";
import { useInboxController } from "./use-inbox-controller";

const notMineAuthorFilter = "not:mine";

type SectionView = "active" | "done";
type InboxItemId = InboxRow["item"]["id"];

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
function serverTimeZone() {
  return "UTC";
}

function subscribeTimeZone() {
  return () => {};
}

function emptyRowsByGroup() {
  return Object.fromEntries(
    inboxSectionDefinitions.map((section) => [section.id, [] as InboxRow[]]),
  ) as Record<InboxGroupId, InboxRow[]>;
}

export function InboxTable({
  rows,
  view,
  initialLayout,
  selectedAuthor,
  selectedRepositoryId,
  selectedRepository,
  localGithubIdentityConfigured,
  codexEnabled,
  updateStatus,
  snoozeItem,
  promoteToShipIt,
  setUserNote,
}: {
  rows: InboxRow[];
  view: SectionView;
  initialLayout: InboxLayout;
  selectedAuthor?: string;
  selectedRepositoryId?: string;
  selectedRepository?: { fullName: string };
  localGithubIdentityConfigured: boolean;
  codexEnabled: boolean;
  updateStatus: (formData: FormData) => void | Promise<void>;
  snoozeItem: (formData: FormData) => void | Promise<void>;
  promoteToShipIt: (formData: FormData) => void | Promise<void>;
  setUserNote: (formData: FormData) => void | Promise<void>;
}) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const authors = Array.from(
    new Set(rows.map((row) => row.item.authorLogin)),
  ).sort((a, b) => a.localeCompare(b));
  const filteredRows = selectedAuthor
    ? rows.filter((row) =>
        selectedAuthor === notMineAuthorFilter
          ? !row.isAuthoredByViewer
          : row.item.authorLogin === selectedAuthor,
      )
    : rows;
  const [sectionViews, setSectionViews] = useState<
    Record<InboxGroupId, SectionView>
  >(
    () =>
      Object.fromEntries(
        inboxSectionDefinitions.map((section) => [section.id, view]),
      ) as Record<InboxGroupId, SectionView>,
  );
  const [layout, setLayout] = useState<InboxLayout>(initialLayout);
  const [listView, setListView] = useState<SectionView>(view);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [previewRowId, setPreviewRowId] = useState<InboxItemId | null>(null);
  const timeZone = useSyncExternalStore(
    subscribeTimeZone,
    browserTimeZone,
    serverTimeZone,
  );
  const {
    actionError,
    clearSelection,
    closeRowMenus,
    exitingRows,
    hiddenRows,
    isPending: isRefreshing,
    isSelectionMode,
    openNoteRow,
    openSnoozeRow,
    refreshInbox,
    removeNote,
    selectedRowIds,
    submitBulkDone,
    submitBulkShipIt,
    submitBulkSnooze,
    submitNote,
    submitShipIt: submitShipItPromotion,
    submitSnooze,
    submitStatus: animateDoneSubmit,
    toggleGroupSelection,
    toggleNote,
    toggleSelection,
    toggleSelectionMode,
    toggleSnooze,
  } = useInboxController({
    initialRefreshAt: now,
    updateStatus,
    snoozeItem,
    promoteToShipIt,
    setUserNote,
  });

  function replaceInboxUrl(
    author: string,
    nextView: SectionView,
    nextLayout: InboxLayout,
  ) {
    const params = new URLSearchParams();
    if (selectedRepositoryId) params.set("repo", selectedRepositoryId);
    if (nextView === "done") params.set("view", nextView);
    if (nextLayout === "visual") params.set("layout", nextLayout);
    if (author) params.set("author", author);

    const query = params.toString();
    router.replace(query ? `/inbox?${query}` : "/inbox");
  }

  function replaceAuthorFilter(author: string) {
    replaceInboxUrl(author, view, layout);
  }

  function replaceListView(nextView: SectionView) {
    clearSelection();
    setListView(nextView);
    replaceInboxUrl(selectedAuthor ?? "", nextView, layout);
  }

  function replaceLayout(nextLayout: InboxLayout) {
    // biome-ignore lint/suspicious/noDocumentCookie: Matches the app's existing theme preference pattern.
    document.cookie = `${inboxLayoutCookieName}=${nextLayout}; Path=/; SameSite=Lax`;
    setLayout(nextLayout);
    replaceInboxUrl(selectedAuthor ?? "", view, nextLayout);
  }

  const visibleRows = filteredRows.filter((row) => !hiddenRows[row.item.id]);
  const selectedRows = visibleRows.filter(
    (row) =>
      selectedRowIds.has(row.item.id) &&
      !isDone(row) &&
      (layout === "visual"
        ? listView === "active"
        : sectionViews[classifyInboxSection(row, now)] === "active"),
  );
  const openCount = visibleRows.filter((row) => !isDone(row)).length;
  const snoozedCount = filteredRows.filter(
    (row) => row.userState?.snoozedUntil,
  ).length;
  const handledCount = filteredRows.filter(
    (row) => row.userState?.status === "done" && !row.userState.snoozedUntil,
  ).length;
  const rowsByGroup = filteredRows.reduce((groups, row) => {
    groups[classifyInboxSection(row, now)].push(row);
    return groups;
  }, emptyRowsByGroup());
  const visualRows = groupInboxRows(
    visibleRows.filter((row) =>
      listView === "done" ? isDone(row) : !isDone(row),
    ),
    now,
  );
  const previewRow = rows.find((row) => row.item.id === previewRowId);

  function replaceSectionView(sectionId: InboxGroupId, nextView: SectionView) {
    clearSelection();
    setSectionViews((views) => ({ ...views, [sectionId]: nextView }));
  }

  function toggleTimeline(inboxItemId: InboxItemId) {
    setExpandedRows((rows) => ({
      ...rows,
      [inboxItemId]: !rows[inboxItemId],
    }));
  }

  function openPreview(row: InboxRow) {
    closeRowMenus();
    setPreviewRowId(row.item.id);
  }

  const controlClass = (selected: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${
      selected
        ? "bg-[var(--selected-control-bg)] text-[var(--selected-control-fg)] shadow-sm"
        : "text-foreground/60"
    }`;

  return (
    <>
      <Surface
        as="header"
        variant="toolbar"
        className="inbox-topbar sticky top-0 z-50 -mx-3 -mt-4 flex flex-wrap items-center gap-3 rounded-none! px-3 py-3 sm:px-4"
      >
        <h1 className="mr-1 text-xl font-semibold leading-none tracking-normal">
          Inbox
        </h1>
        {selectedRepository ? (
          <a
            href={`https://github.com/${selectedRepository.fullName}/pulls`}
            target="_blank"
            rel="noreferrer"
            className="app-inset-surface inline-flex min-w-0 max-w-full items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-foreground/75 shadow-sm transition hover:text-foreground"
          >
            <GitPullRequestArrow className="size-3.5 shrink-0 text-foreground/45" />
            <span className="min-w-0 truncate">
              {selectedRepository.fullName}
            </span>
            <ExternalLink className="size-3 shrink-0 text-foreground/45" />
          </a>
        ) : null}
        <label className="app-inset-surface inline-flex max-w-full items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-foreground/75 shadow-sm">
          <UserRound className="size-3.5 shrink-0 text-foreground/45" />
          <span className="text-foreground/50">Author</span>
          <select
            className="min-w-0 bg-transparent font-semibold outline-none"
            value={selectedAuthor ?? ""}
            disabled={rows.length === 0}
            onChange={(event) => replaceAuthorFilter(event.currentTarget.value)}
          >
            <option value="">All</option>
            <option value={notMineAuthorFilter}>Not mine</option>
            {authors.map((author) => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3 whitespace-nowrap text-xs text-foreground/55">
          <span>
            <strong className="font-semibold text-foreground">
              {openCount}
            </strong>{" "}
            open
          </span>
          <span>
            <strong className="font-semibold text-foreground">
              {snoozedCount}
            </strong>{" "}
            snoozed
          </span>
          <span>
            <strong className="font-semibold text-foreground">
              {handledCount}
            </strong>{" "}
            handled
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {layout === "visual" ? (
            <div className="inline-flex rounded-md border border-foreground/10 bg-background/70 p-0.5 text-xs shadow-sm">
              <button
                type="button"
                className={controlClass(listView === "active")}
                aria-pressed={listView === "active"}
                onClick={() => replaceListView("active")}
              >
                Active
              </button>
              <button
                type="button"
                className={controlClass(listView === "done")}
                aria-pressed={listView === "done"}
                onClick={() => replaceListView("done")}
              >
                Handled
              </button>
            </div>
          ) : null}
          <div className="inline-flex rounded-md border border-foreground/10 bg-background/70 p-0.5 text-xs shadow-sm">
            <button
              type="button"
              className={controlClass(isSelectionMode)}
              aria-pressed={isSelectionMode}
              title={
                isSelectionMode ? "Disable multi-select" : "Enable multi-select"
              }
              onClick={toggleSelectionMode}
            >
              <ListChecks className="size-3.5" />
              {isSelectionMode ? "Selecting" : "Select"}
            </button>
          </div>
          <div className="inline-flex rounded-md border border-foreground/10 bg-background/70 p-0.5 text-xs shadow-sm">
            <button
              type="button"
              className={controlClass(layout === "grouped")}
              aria-pressed={layout === "grouped"}
              onClick={() => replaceLayout("grouped")}
            >
              <LayoutGrid className="size-3.5" />
              Grouped
            </button>
            <button
              type="button"
              className={controlClass(layout === "visual")}
              aria-pressed={layout === "visual"}
              onClick={() => replaceLayout("visual")}
            >
              <List className="size-3.5" />
              List
            </button>
          </div>
          <button
            type="button"
            className="app-inset-surface inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-sm font-medium shadow-sm transition disabled:opacity-60"
            disabled={isRefreshing}
            onClick={refreshInbox}
            title="Refresh inbox"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
        {!localGithubIdentityConfigured ? (
          <Notice tone="warning" className="basis-full px-2.5 py-1.5">
            Run pnpm mergetray setup to enable personal review sections.
          </Notice>
        ) : null}
        {actionError ? (
          <Notice
            tone="danger"
            role="alert"
            className="basis-full px-2.5 py-1.5"
          >
            {actionError}
          </Notice>
        ) : null}
      </Surface>
      {selectedRows.length ? (
        <InboxBulkActions
          selectedCount={selectedRows.length}
          isPending={isRefreshing}
          onShipIt={() => submitBulkShipIt(selectedRows)}
          onSnooze={(duration) => submitBulkSnooze(selectedRows, duration)}
          onDone={() => submitBulkDone(selectedRows)}
          onClear={clearSelection}
        />
      ) : null}
      <section
        className={`mt-4 grid gap-3 ${selectedRows.length ? "pb-24" : ""}`}
      >
        {!selectedAuthor && openCount === 0 && filteredRows.some(isDone) ? (
          <InboxZeroState />
        ) : null}
        {layout === "grouped" ? (
          inboxSectionDefinitions.map((section) => (
            <InboxSection
              key={section.id}
              section={section}
              rows={rowsByGroup[section.id]}
              groupView={sectionViews[section.id]}
              hiddenRows={hiddenRows}
              expandedRows={expandedRows}
              exitingRows={exitingRows}
              openSnoozeRow={openSnoozeRow}
              openNoteRow={openNoteRow}
              now={now}
              timeZone={timeZone}
              selectionEnabled={isSelectionMode}
              selectedRowIds={selectedRowIds}
              updateStatus={updateStatus}
              snoozeItem={snoozeItem}
              promoteToShipIt={promoteToShipIt}
              setUserNote={setUserNote}
              onViewChange={replaceSectionView}
              onStatusSubmit={animateDoneSubmit}
              onSnoozeSubmit={submitSnooze}
              onShipItSubmit={submitShipItPromotion}
              onNoteSubmit={submitNote}
              onRemoveNoteSubmit={removeNote}
              onToggleTimeline={toggleTimeline}
              onToggleSelection={toggleSelection}
              onToggleGroupSelection={toggleGroupSelection}
              onToggleSnooze={toggleSnooze}
              onToggleNote={toggleNote}
              onPreview={openPreview}
            />
          ))
        ) : (
          <div className="inbox-list">
            {visualRows.map((group) => {
              const isStack = group.rows.length > 1;
              const firstDetails = group.rows[0].pullRequestDetails;
              const lastDetails = group.rows.at(-1)?.pullRequestDetails;

              return (
                <Surface
                  as="section"
                  key={group.rows[0].item.id}
                  className="overflow-visible"
                >
                  {isStack ? (
                    <div className="inbox-section-header flex items-center justify-between gap-3 border-b border-foreground/10 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-foreground/7">
                          <GitPullRequestArrow className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/65">
                            Stack · {group.rows.length} pull requests
                          </h2>
                          <p className="truncate font-mono text-[11px] text-foreground/45">
                            {firstDetails?.baseRef} → {lastDetails?.headRef}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] text-foreground/45">
                        moves together
                      </span>
                    </div>
                  ) : null}
                  <div className="divide-y divide-foreground/10">
                    {group.rows.map((row, index) => {
                      const sectionId = classifyInboxSection(row, now);
                      const stackPosition =
                        index === 0
                          ? "first"
                          : index === group.rows.length - 1
                            ? "last"
                            : "middle";

                      return (
                        <InboxRowCard
                          key={row.item.id}
                          row={row}
                          sectionId={sectionId}
                          groupView={listView}
                          visuallyIndicated
                          stackPosition={isStack ? stackPosition : undefined}
                          now={now}
                          timeZone={timeZone}
                          isTimelineExpanded={
                            expandedRows[row.item.id] ?? false
                          }
                          selectionEnabled={isSelectionMode}
                          isSelected={selectedRowIds.has(row.item.id)}
                          exitKind={
                            listView === "active"
                              ? exitingRows[row.item.id]
                              : undefined
                          }
                          isSnoozeOpen={openSnoozeRow === row.item.id}
                          isNoteOpen={openNoteRow === row.item.id}
                          updateStatus={updateStatus}
                          snoozeItem={snoozeItem}
                          promoteToShipIt={promoteToShipIt}
                          setUserNote={setUserNote}
                          onStatusSubmit={animateDoneSubmit}
                          onSnoozeSubmit={submitSnooze}
                          onShipItSubmit={submitShipItPromotion}
                          onNoteSubmit={submitNote}
                          onRemoveNoteSubmit={removeNote}
                          onToggleTimeline={toggleTimeline}
                          onToggleSelection={toggleSelection}
                          onToggleSnooze={toggleSnooze}
                          onToggleNote={toggleNote}
                          onPreview={openPreview}
                        />
                      );
                    })}
                  </div>
                </Surface>
              );
            })}
          </div>
        )}
        {layout === "visual" && visualRows.length === 0 && rows.length ? (
          <Surface className="px-4 py-10 text-center text-sm text-foreground/50">
            No {listView === "done" ? "handled" : "active"} items.
          </Surface>
        ) : null}
        {rows.length === 0 ? (
          <Surface className="px-4 py-12 text-center">
            <p className="font-medium">No open pull requests yet.</p>
            <p className="mt-2 text-sm text-foreground/55">
              Connect GitHub in Settings, then run a sync.
            </p>
          </Surface>
        ) : null}
      </section>
      {previewRow ? (
        <PrPreviewDrawer
          row={previewRow}
          timeZone={timeZone}
          codexEnabled={codexEnabled}
          onClose={() => setPreviewRowId(null)}
        />
      ) : null}
    </>
  );
}
