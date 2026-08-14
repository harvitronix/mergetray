"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

const revisionCheckIntervalMs = 2_000;
const githubSyncIntervalMs = 5 * 60_000;

export function BackgroundSync({
  enabled,
  githubRevision,
}: {
  enabled: boolean;
  githubRevision: number;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const revision = useRef(githubRevision);

  useEffect(() => {
    revision.current = githubRevision;
  }, [githubRevision]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    void fetch("/api/sync", { method: "POST" })
      .catch(() => undefined)
      .then(() => {
        if (!active) return;
        startTransition(() => router.refresh());
      });

    return () => {
      active = false;
    };
  }, [enabled, router]);

  useEffect(() => {
    if (enabled) return;
    let checking = false;

    async function refreshForWebhookUpdate() {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch("/api/github/revision", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const next = (await response.json()) as { revision: number };
        if (next.revision === revision.current) return;
        revision.current = next.revision;
        startTransition(() => router.refresh());
      } catch {
        // The five-minute GitHub sync remains the recovery path.
      } finally {
        checking = false;
      }
    }

    const interval = window.setInterval(
      () => void refreshForWebhookUpdate(),
      revisionCheckIntervalMs,
    );
    return () => window.clearInterval(interval);
  }, [enabled, router]);

  useEffect(() => {
    let active = true;

    const interval = window.setInterval(() => {
      void fetch("/api/sync", { method: "POST" })
        .catch(() => undefined)
        .then(() => {
          if (!active) return;
          startTransition(() => router.refresh());
        });
    }, githubSyncIntervalMs);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [router]);

  if (!enabled && !refreshing) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-lg bg-[var(--selected-control-bg)] px-3 py-2 text-sm font-medium text-[var(--selected-control-fg)] shadow-lg"
    >
      <RefreshCw className="size-4 animate-spin" />
      Syncing inbox
    </div>
  );
}
