"use client";

import { Bot, ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { PostDeployRun } from "@/lib/post-deploy-monitor";

const activeStatuses = new Set<PostDeployRun["status"]>(["queued", "running"]);

function resultTone(overall: NonNullable<PostDeployRun["result"]>["overall"]) {
  if (overall === "ready") return "text-emerald-700 dark:text-emerald-300";
  if (overall === "partial") return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
}

export function PostDeployAudit({
  disabledReason,
  initialRun,
  inboxItemId,
}: {
  disabledReason?: string;
  initialRun?: PostDeployRun;
  inboxItemId: string;
}) {
  const [run, setRun] = useState(initialRun);
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!run || !activeStatuses.has(run.status)) return;
    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/post-deploy?runId=${run.id}`, {
        cache: "no-store",
      });
      if (response.ok) setRun((await response.json()) as PostDeployRun);
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [run]);

  async function start() {
    setStarting(true);
    setError(undefined);
    try {
      const response = await fetch("/api/post-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxItemId }),
      });
      const result = (await response.json()) as PostDeployRun & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "Audit could not start.");
      setRun(result);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Audit could not start.",
      );
    } finally {
      setStarting(false);
    }
  }

  const active = starting || (run && activeStatuses.has(run.status));
  const actionLabel = run
    ? run.status === "completed"
      ? "Run again"
      : "Resume audit"
    : "Run capability audit";

  return (
    <div className="mt-3 border-t border-foreground/10 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={start}
          disabled={Boolean(disabledReason) || active}
          title={disabledReason}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-foreground/10 bg-background/70 px-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {active ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : run ? (
            <RotateCcw className="size-3.5" />
          ) : (
            <Bot className="size-3.5" />
          )}
          {active ? "Auditing capabilities" : actionLabel}
        </button>
        {run?.threadId ? (
          <a
            href={`/codex?thread=${encodeURIComponent(run.threadId)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground/60 hover:text-foreground"
          >
            Open Codex task
            <ExternalLink className="size-3" />
          </a>
        ) : null}
        {run ? (
          <span className="text-xs text-foreground/45">
            Attempt {run.attempts || 1}
          </span>
        ) : null}
      </div>

      {disabledReason && !run ? (
        <p className="mt-2 text-xs text-foreground/50">{disabledReason}</p>
      ) : null}
      {error || run?.error ? (
        <p className="mt-2 text-xs text-[var(--danger-text)]">
          {error ?? run?.error}
        </p>
      ) : null}
      {run?.result ? (
        <div className="mt-3 text-xs">
          <p
            className={`font-semibold capitalize ${resultTone(run.result.overall)}`}
          >
            {run.result.overall}
          </p>
          <p className="mt-1 text-foreground/65">{run.result.summary}</p>
          <details className="mt-2 text-foreground/60">
            <summary className="cursor-pointer font-medium">
              Evidence from {run.result.checks.length} checks
            </summary>
            <ul className="mt-2 grid gap-1.5 pl-4">
              {run.result.checks.map((check) => (
                <li key={check.capability}>
                  <span className="font-medium">
                    {check.capability.replaceAll("_", " ")}: {check.status}
                  </span>{" "}
                  {check.evidence}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              <span className="font-medium">Next:</span> {run.result.nextStep}
            </p>
          </details>
        </div>
      ) : null}
    </div>
  );
}
