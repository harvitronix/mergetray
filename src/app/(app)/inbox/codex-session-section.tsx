"use client";

import { Bot, ExternalLink, Link2, Plus, Unlink, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { codexSessionUrl, newCodexSessionUrl } from "@/lib/codex-links";
import type { AgentSessionLookup, InboxRow } from "@/lib/models";
import {
  dismissCodexSession,
  linkCodexSession,
  unlinkCodexSession,
} from "./actions";

function updatedLabel(value: number, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export function CodexSessionSection({
  row,
  timeZone,
}: {
  row: InboxRow;
  timeZone: string;
}) {
  const router = useRouter();
  const initialLink = row.agentSessionLinks.find(
    (session) => session.provider === "codex",
  );
  const [lookup, setLookup] = useState<AgentSessionLookup>({
    link: initialLink,
    candidates: [],
    autoLinked: false,
  });
  const [loading, setLoading] = useState(true);
  const link = lookup.link;
  const linkedCandidate = lookup.candidates.find(
    (session) => session.sessionId === link?.sessionId,
  );
  const candidates = lookup.candidates.filter(
    (session) => session.sessionId !== link?.sessionId,
  );
  const details = row.pullRequestDetails;
  const repository = row.repository;

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/codex/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inboxItemId: row.item.id }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Codex task lookup failed.");
        const result = (await response.json()) as AgentSessionLookup;
        setLookup(result);
        if (result.autoLinked) router.refresh();
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setLookup((current) => ({
          ...current,
          error: "Codex task lookup failed.",
        }));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [row.item.id, router]);

  async function linkSession(formData: FormData) {
    const sessionId = await linkCodexSession(formData);
    if (!sessionId) return;
    setLookup((current) => ({
      ...current,
      link: { provider: "codex", sessionId },
    }));
  }

  async function unlinkSession(formData: FormData) {
    if (!(await unlinkCodexSession(formData))) return;
    setLookup((current) => ({ ...current, link: undefined }));
  }

  async function dismissSession(formData: FormData) {
    const sessionId = await dismissCodexSession(formData);
    if (!sessionId) return;
    setLookup((current) => ({
      ...current,
      candidates: current.candidates.filter(
        (session) => session.sessionId !== sessionId,
      ),
    }));
  }

  if (!details || !repository) return null;

  const newSessionUrl = newCodexSessionUrl({
    repository: repository.fullName,
    number: row.item.number,
    title: row.item.title,
    url: row.item.url,
    branch: details.headRef,
  });

  return (
    <section aria-labelledby="codex-heading">
      <div className="flex items-center justify-between gap-3">
        <h3
          id="codex-heading"
          className="flex items-center gap-1.5 text-sm font-semibold"
        >
          <Bot className="size-3.5" />
          Codex
        </h3>
        <span className="text-xs text-foreground/45">
          {loading
            ? "Loading…"
            : link
              ? "Linked"
              : `${candidates.length} suggested`}
        </span>
      </div>

      {lookup.error ? (
        <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-[var(--danger-text)]">
          {lookup.error}
        </p>
      ) : null}

      {link ? (
        <div className="app-inset-surface mt-3 flex items-center gap-3 px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {linkedCandidate?.title ?? "Linked Codex task"}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-foreground/45">
              {details.headRef}
            </p>
          </div>
          {linkedCandidate?.archived ? (
            <a
              href="codex://settings"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-foreground/10 bg-background/70 px-2.5 text-xs font-semibold"
              title="Unarchive this task in Codex, then refresh MergeTray"
            >
              Unarchive in Codex
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <a
              href={codexSessionUrl(link.sessionId)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[var(--selected-control-bg)] px-2.5 text-xs font-semibold text-[var(--selected-control-fg)]"
            >
              Open
              <ExternalLink className="size-3" />
            </a>
          )}
          <form action={unlinkSession}>
            <input type="hidden" name="inboxItemId" value={row.item.id} />
            <button
              type="submit"
              className="grid size-8 place-items-center rounded-md border border-foreground/10 bg-background/70 text-foreground/55"
              aria-label="Unlink Codex task"
              title="Unlink Codex task"
            >
              <Unlink className="size-3.5" />
            </button>
          </form>
        </div>
      ) : loading || candidates.length || lookup.error ? null : (
        <p className="app-inset-surface mt-3 px-3 py-3 text-sm text-foreground/55">
          No Codex task found on {details.headRef}. You can start one or paste
          an existing task link.
        </p>
      )}

      {candidates.length ? (
        <div className="mt-2 grid gap-2">
          {candidates.map((session) => (
            <div
              key={session.sessionId}
              className="app-inset-surface flex min-w-0 items-center gap-3 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{session.title}</p>
                <p className="mt-0.5 truncate text-xs text-foreground/45">
                  {updatedLabel(session.updatedAt, timeZone)}
                  {session.archived ? " · archived" : ""}
                  {session.cwd ? ` · ${session.cwd}` : ""}
                </p>
              </div>
              {session.archived ? (
                <a
                  href="codex://settings"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-foreground/10 bg-background/70 px-2.5 text-xs font-semibold"
                  title="Unarchive this task in Codex, then refresh MergeTray"
                >
                  Unarchive in Codex
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <a
                  href={codexSessionUrl(session.sessionId)}
                  className="inline-flex h-8 shrink-0 items-center rounded-md border border-foreground/10 bg-background/70 px-2.5 text-xs font-semibold"
                >
                  Open
                </a>
              )}
              {session.archived ? null : (
                <form action={linkSession}>
                  <input type="hidden" name="inboxItemId" value={row.item.id} />
                  <input
                    type="hidden"
                    name="session"
                    value={session.sessionId}
                  />
                  <button
                    type="submit"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[var(--selected-control-bg)] px-2.5 text-xs font-semibold text-[var(--selected-control-fg)]"
                  >
                    <Link2 className="size-3" />
                    Link
                  </button>
                </form>
              )}
              <form action={dismissSession}>
                <input type="hidden" name="inboxItemId" value={row.item.id} />
                <input type="hidden" name="session" value={session.sessionId} />
                <button
                  type="submit"
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-foreground/10 bg-background/70 text-foreground/50"
                  aria-label={`Dismiss ${session.title}`}
                  title="Dismiss suggestion"
                >
                  <X className="size-3.5" />
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={newSessionUrl}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-foreground/10 bg-background/70 px-3 text-xs font-semibold"
        >
          <Plus className="size-3.5" />
          New Codex task
        </a>
        <details className="relative">
          <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-foreground/10 bg-background/70 px-3 text-xs font-semibold">
            <Link2 className="size-3.5" />
            Link another
          </summary>
          <form
            action={linkSession}
            className="absolute right-0 top-10 z-20 flex w-80 gap-2 rounded-lg border border-foreground/10 bg-background p-2 shadow-xl"
          >
            <input type="hidden" name="inboxItemId" value={row.item.id} />
            <input
              name="session"
              required
              autoComplete="off"
              placeholder="Codex task link or ID"
              aria-label="Codex task link or ID"
              className="h-9 min-w-0 flex-1 rounded-md border border-foreground/10 bg-transparent px-2.5 text-sm outline-none"
            />
            <button
              type="submit"
              className="h-9 rounded-md bg-[var(--selected-control-bg)] px-3 text-xs font-semibold text-[var(--selected-control-fg)]"
            >
              Link
            </button>
          </form>
        </details>
      </div>
    </section>
  );
}
