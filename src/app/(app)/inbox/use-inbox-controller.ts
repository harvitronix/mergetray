"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { InboxRow } from "@/lib/models";
import { localSnoozeTime, type SnoozeDuration } from "./inbox-snooze";

const doneExitAnimationMs = 860;
const automaticRefreshIntervalMs = 5 * 60 * 1000;
const actionErrorMessage = "Couldn’t save that inbox change. Please try again.";

type InboxItemId = InboxRow["item"]["id"];
type InboxAction = (formData: FormData) => void | Promise<void>;

export function useInboxController({
  initialRefreshAt,
  updateStatus,
  snoozeItem,
  promoteToShipIt,
  setUserNote,
}: {
  initialRefreshAt: number;
  updateStatus: InboxAction;
  snoozeItem: InboxAction;
  promoteToShipIt: InboxAction;
  setUserNote: InboxAction;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lastRefreshAt = useRef(initialRefreshAt);
  const [exitingRows, setExitingRows] = useState<
    Record<string, "done" | "snooze">
  >({});
  const [hiddenRows, setHiddenRows] = useState<Record<string, boolean>>({});
  const [selectedRowIds, setSelectedRowIds] = useState<Set<InboxItemId>>(
    () => new Set(),
  );
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [openSnoozeRow, setOpenSnoozeRow] = useState<string | null>(null);
  const [openNoteRow, setOpenNoteRow] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshNow = useCallback(() => {
    lastRefreshAt.current = Date.now();
    setOpenSnoozeRow(null);
    setOpenNoteRow(null);
    router.refresh();
  }, [router]);

  const refreshInbox = useCallback(() => {
    setActionError(null);
    startTransition(refreshNow);
  }, [refreshNow]);

  const refreshInboxIfStale = useCallback(() => {
    if (Date.now() - lastRefreshAt.current >= automaticRefreshIntervalMs) {
      refreshInbox();
    }
  }, [refreshInbox]);

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") refreshInboxIfStale();
    }

    window.addEventListener("focus", refreshInboxIfStale);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshInboxIfStale);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshInboxIfStale]);

  function restoreRows(inboxItemIds: InboxItemId[]) {
    setHiddenRows((rows) => {
      const restoredRows = { ...rows };
      for (const inboxItemId of inboxItemIds) delete restoredRows[inboxItemId];
      return restoredRows;
    });
    setExitingRows((rows) => {
      const restoredRows = { ...rows };
      for (const inboxItemId of inboxItemIds) delete restoredRows[inboxItemId];
      return restoredRows;
    });
  }

  function invokeAction(
    action: InboxAction,
    formData: FormData,
    onFailure?: () => void,
  ) {
    setActionError(null);
    startTransition(async () => {
      try {
        await action(formData);
      } catch {
        onFailure?.();
        setActionError(actionErrorMessage);
      } finally {
        refreshNow();
      }
    });
  }

  function submitStatus(
    event: FormEvent<HTMLFormElement>,
    inboxItemId: InboxItemId,
  ) {
    if (exitingRows[inboxItemId]) return;

    const formData = new FormData(event.currentTarget);
    const status = formData.get("status");
    if (status !== "active" && status !== "done") return;

    event.preventDefault();
    setActionError(null);
    if (status === "active") {
      setHiddenRows((rows) => ({ ...rows, [inboxItemId]: true }));
      invokeAction(updateStatus, formData, () => restoreRows([inboxItemId]));
      return;
    }

    setExitingRows((rows) => ({ ...rows, [inboxItemId]: "done" }));
    window.setTimeout(() => {
      setHiddenRows((rows) => ({ ...rows, [inboxItemId]: true }));
      invokeAction(updateStatus, formData, () => restoreRows([inboxItemId]));
    }, doneExitAnimationMs);
  }

  function submitSnooze(
    event: FormEvent<HTMLFormElement>,
    inboxItemId: InboxItemId,
  ) {
    if (exitingRows[inboxItemId]) return;

    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const duration = formData.get("duration") as SnoozeDuration;
    const snoozedUntil = localSnoozeTime(duration);
    if (snoozedUntil) formData.set("snoozedUntil", String(snoozedUntil));

    setActionError(null);
    setOpenSnoozeRow(null);
    setExitingRows((rows) => ({ ...rows, [inboxItemId]: "snooze" }));
    window.setTimeout(() => {
      setHiddenRows((rows) => ({ ...rows, [inboxItemId]: true }));
      invokeAction(snoozeItem, formData, () => restoreRows([inboxItemId]));
    }, doneExitAnimationMs);
  }

  function toggleSelection(inboxItemId: InboxItemId) {
    setSelectedRowIds((selectedIds) => {
      const nextIds = new Set(selectedIds);
      if (nextIds.has(inboxItemId)) nextIds.delete(inboxItemId);
      else nextIds.add(inboxItemId);
      return nextIds;
    });
  }

  function toggleGroupSelection(inboxItemIds: InboxItemId[]) {
    setSelectedRowIds((selectedIds) => {
      const nextIds = new Set(selectedIds);
      const allSelected = inboxItemIds.every((id) => nextIds.has(id));
      for (const id of inboxItemIds) {
        if (allSelected) nextIds.delete(id);
        else nextIds.add(id);
      }
      return nextIds;
    });
  }

  function clearSelection() {
    setSelectedRowIds(new Set());
  }

  function toggleSelectionMode() {
    if (isSelectionMode) clearSelection();
    setIsSelectionMode(!isSelectionMode);
  }

  function selectedFormData(selectedRows: InboxRow[]) {
    const formData = new FormData();
    for (const row of selectedRows) {
      formData.append("inboxItemId", row.item.id);
    }
    return formData;
  }

  function submitBulkExit(
    kind: "done" | "snooze",
    action: InboxAction,
    formData: FormData,
    selectedRows: InboxRow[],
  ) {
    const inboxItemIds = selectedRows.map((row) => row.item.id);
    setActionError(null);
    setExitingRows((rows) => ({
      ...rows,
      ...Object.fromEntries(inboxItemIds.map((id) => [id, kind])),
    }));
    clearSelection();
    window.setTimeout(() => {
      setHiddenRows((rows) => ({
        ...rows,
        ...Object.fromEntries(inboxItemIds.map((id) => [id, true])),
      }));
      invokeAction(action, formData, () => {
        restoreRows(inboxItemIds);
        setSelectedRowIds(new Set(inboxItemIds));
      });
    }, doneExitAnimationMs);
  }

  function submitBulkDone(selectedRows: InboxRow[]) {
    const formData = selectedFormData(selectedRows);
    formData.set("status", "done");
    submitBulkExit("done", updateStatus, formData, selectedRows);
  }

  function submitBulkSnooze(
    selectedRows: InboxRow[],
    duration: SnoozeDuration,
  ) {
    const formData = selectedFormData(selectedRows);
    formData.set("duration", duration);
    const snoozedUntil = localSnoozeTime(duration);
    if (snoozedUntil) formData.set("snoozedUntil", String(snoozedUntil));
    submitBulkExit("snooze", snoozeItem, formData, selectedRows);
  }

  function submitBulkShipIt(selectedRows: InboxRow[]) {
    const formData = selectedFormData(selectedRows);
    const inboxItemIds = selectedRows.map((row) => row.item.id);
    formData.set("promoted", "true");
    clearSelection();
    invokeAction(promoteToShipIt, formData, () => {
      setSelectedRowIds(new Set(inboxItemIds));
    });
  }

  function submitShipIt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invokeAction(promoteToShipIt, new FormData(event.currentTarget));
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!String(formData.get("note") ?? "").trim()) return;

    setOpenNoteRow(null);
    invokeAction(setUserNote, formData);
  }

  function removeNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invokeAction(setUserNote, new FormData(event.currentTarget));
  }

  function toggleSnooze(inboxItemId: InboxItemId) {
    setOpenNoteRow(null);
    setOpenSnoozeRow((rowId) => (rowId === inboxItemId ? null : inboxItemId));
  }

  function toggleNote(inboxItemId: InboxItemId) {
    setOpenSnoozeRow(null);
    setOpenNoteRow((rowId) => (rowId === inboxItemId ? null : inboxItemId));
  }

  function closeRowMenus() {
    setOpenSnoozeRow(null);
    setOpenNoteRow(null);
  }

  return {
    actionError,
    clearSelection,
    closeRowMenus,
    exitingRows,
    hiddenRows,
    isPending,
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
    submitShipIt,
    submitSnooze,
    submitStatus,
    toggleGroupSelection,
    toggleNote,
    toggleSelection,
    toggleSelectionMode,
    toggleSnooze,
  };
}
