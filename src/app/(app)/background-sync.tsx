"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

const revisionCheckIntervalMs = 2_000;
const githubSyncIntervalMs = 5 * 60_000;

async function syncRevision() {
  const response = await fetch("/api/sync", { method: "POST" });
  if (!response.ok) return;
  return (await response.json()) as { revision: number; failed: boolean };
}

export function BackgroundSync({
  enabled,
  githubRevision,
  webhooksEnabled,
}: {
  enabled: boolean;
  githubRevision: number;
  webhooksEnabled: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(enabled);
  const revision = useRef(githubRevision);

  const refreshForRevision = useCallback(
    (nextRevision: number, force = false) => {
      const changed = nextRevision !== revision.current;
      revision.current = nextRevision;
      if (changed || force) startTransition(() => router.refresh());
    },
    [router],
  );

  useEffect(() => {
    revision.current = githubRevision;
  }, [githubRevision]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    void syncRevision()
      .catch(() => undefined)
      .then((result) => {
        if (active && result)
          refreshForRevision(result.revision, result.failed);
      })
      .finally(() => {
        if (active) setSyncing(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, refreshForRevision]);

  useEffect(() => {
    if (!webhooksEnabled) return;
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
        refreshForRevision(next.revision);
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
  }, [refreshForRevision, webhooksEnabled]);

  useEffect(() => {
    let active = true;

    const interval = window.setInterval(() => {
      setSyncing(true);
      void syncRevision()
        .catch(() => undefined)
        .then((result) => {
          if (active && result)
            refreshForRevision(result.revision, result.failed);
        })
        .finally(() => {
          if (active) setSyncing(false);
        });
    }, githubSyncIntervalMs);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshForRevision]);

  if (!syncing) return null;

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
