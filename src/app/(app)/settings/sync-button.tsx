"use client";

import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SyncButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-foreground/15 bg-[var(--surface-bg)] px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Syncing" : "Sync now"}
    </button>
  );
}
