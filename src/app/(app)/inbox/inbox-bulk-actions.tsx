"use client";

import { Check, ChevronDown, Clock3, Rocket, X } from "lucide-react";
import { useState } from "react";
import { Surface } from "@/components/app-ui";
import { type SnoozeDuration, snoozeOptions } from "./inbox-snooze";

export function InboxBulkActions({
  selectedCount,
  isPending,
  onShipIt,
  onSnooze,
  onDone,
  onClear,
}: {
  selectedCount: number;
  isPending: boolean;
  onShipIt: () => void;
  onSnooze: (duration: SnoozeDuration) => void;
  onDone: () => void;
  onClear: () => void;
}) {
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);

  return (
    <Surface
      variant="toolbar"
      className="inbox-selection-toolbar fixed right-3 bottom-3 left-3 z-40 flex flex-wrap items-center justify-between gap-2 px-3 py-2 shadow-xl lg:left-[268px]"
      role="toolbar"
      aria-label="Actions for selected inbox items"
    >
      <span className="px-1 text-sm font-semibold">
        {selectedCount} {selectedCount === 1 ? "PR selected" : "PRs selected"}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-background px-2.5 text-xs font-semibold text-foreground shadow-sm disabled:opacity-60"
          disabled={isPending}
          onClick={onShipIt}
        >
          <Rocket className="size-3" />
          Ship It
        </button>
        <div className="relative">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-md bg-background px-2.5 text-xs font-semibold text-foreground shadow-sm disabled:opacity-60"
            disabled={isPending}
            aria-expanded={isSnoozeOpen}
            onClick={() => setIsSnoozeOpen((open) => !open)}
          >
            <Clock3 className="size-3" />
            Sleep
            <ChevronDown className="size-3 text-foreground/45" />
          </button>
          {isSnoozeOpen ? (
            <div className="absolute right-0 bottom-9 z-50 w-36 overflow-hidden rounded-lg border border-foreground/10 bg-background text-foreground shadow-xl">
              {snoozeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs font-medium"
                  onClick={() => onSnooze(option.value)}
                >
                  <Clock3 className="size-3.5 text-foreground/45" />
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-background px-2.5 text-xs font-semibold text-foreground shadow-sm disabled:opacity-60"
          disabled={isPending}
          onClick={onDone}
        >
          <Check className="size-3" />
          Done
        </button>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-background opacity-70 hover:opacity-100"
          aria-label="Clear selection"
          title="Clear selection"
          onClick={onClear}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </Surface>
  );
}
