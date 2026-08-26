"use client";

import { ArchiveX, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function CleanupWorktreeButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      onClick={(event) => {
        if (
          !window.confirm(
            "Archive this Codex task and remove its clean managed worktree?",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-foreground/10 bg-background px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
    >
      {pending ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <ArchiveX className="size-3.5" />
      )}
      {pending ? "Cleaning up…" : "Archive and clean up"}
    </button>
  );
}
