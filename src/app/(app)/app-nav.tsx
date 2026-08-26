"use client";

import {
  Bot,
  ChevronDown,
  GitMerge,
  GitPullRequest,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useState } from "react";

const baseClass = "flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2";
const activeClass = "sidebar-nav-active font-medium";
const inactiveClass = "text-[color:var(--sidebar-muted)]";

type Counts = {
  all: number;
  repositories: Array<{
    repositoryId: string;
    active: number;
  }>;
};

type Repository = {
  id: string;
  name: string;
  fullName: string;
};

function CountBadge({
  value,
  collapsed,
}: {
  value: number;
  collapsed: boolean;
}) {
  if (value === 0) return null;

  return (
    <span
      className={`sidebar-count ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${collapsed ? "lg:hidden" : ""}`}
    >
      {value}
    </span>
  );
}

export function AppNav({
  codexEnabled,
  counts,
  collapsed,
  repositories,
}: {
  codexEnabled: boolean;
  counts: Counts;
  collapsed: boolean;
  repositories: Repository[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedRepositoryId = searchParams.get("repo");
  const isSettings = pathname.startsWith("/settings");
  const isCodex = pathname.startsWith("/codex");
  const isRecentlyMerged = pathname.startsWith("/merged");
  const isInbox = pathname === "/" || pathname.startsWith("/inbox");
  const repositoryCounts = new Map(
    counts.repositories.map(({ repositoryId, active }) => [
      repositoryId,
      active,
    ]),
  );
  const navClass = `${baseClass} ${collapsed ? "lg:justify-center lg:px-2" : ""}`;
  const labelClass = collapsed ? "lg:hidden" : "";

  return (
    <nav
      id="app-sidebar-nav"
      className="mt-6 flex flex-1 flex-col gap-5 text-sm"
    >
      <div className="grid gap-1">
        <p
          className={`mb-1 px-2.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[color:var(--sidebar-muted)] ${labelClass}`}
        >
          Workspace
        </p>
        <Link
          href="/inbox"
          className={`${navClass} ${isInbox && !selectedRepositoryId ? activeClass : inactiveClass}`}
          aria-current={isInbox && !selectedRepositoryId ? "page" : undefined}
          aria-label="Inbox"
          title={collapsed ? "Inbox" : undefined}
        >
          <Inbox className="size-4 shrink-0" />
          <span className={labelClass}>Inbox</span>
          <CountBadge value={counts.all} collapsed={collapsed} />
        </Link>
        <Link
          href="/merged"
          className={`${navClass} ${isRecentlyMerged ? activeClass : inactiveClass}`}
          aria-current={isRecentlyMerged ? "page" : undefined}
          aria-label="Recently merged"
          title={collapsed ? "Recently merged" : undefined}
        >
          <GitMerge className="size-4 shrink-0" />
          <span className={labelClass}>Recently merged</span>
        </Link>
        {codexEnabled ? (
          <Link
            href="/codex"
            className={`${navClass} ${isCodex ? activeClass : inactiveClass}`}
            aria-current={isCodex ? "page" : undefined}
            aria-label="Codex"
            title={collapsed ? "Codex" : undefined}
          >
            <Bot className="size-4 shrink-0" />
            <span className={labelClass}>Codex</span>
          </Link>
        ) : null}
      </div>
      <details key={String(collapsed)} className="group grid gap-1" open>
        <summary
          className={`flex cursor-pointer list-none items-center gap-2 px-2.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[color:var(--sidebar-muted)] ${labelClass}`}
        >
          Repositories
          <ChevronDown className="ml-auto size-3 transition group-open:rotate-180" />
        </summary>
        <div className="mt-1 grid gap-1">
          {repositories.map((repository) => {
            const isActive = isInbox && selectedRepositoryId === repository.id;

            return (
              <Link
                key={repository.id}
                href={`/inbox?repo=${repository.id}`}
                className={`${navClass} ${isActive ? activeClass : inactiveClass}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={repository.fullName}
                title={repository.fullName}
              >
                <GitPullRequest className="size-3.5 shrink-0" />
                <span className={`block min-w-0 truncate ${labelClass}`}>
                  {repository.name}
                </span>
                <CountBadge
                  value={repositoryCounts.get(repository.id) ?? 0}
                  collapsed={collapsed}
                />
              </Link>
            );
          })}
        </div>
      </details>
      <div className="sidebar-divider mt-auto grid gap-1 border-t pt-3">
        <Link
          href="/settings"
          className={`${navClass} ${isSettings ? activeClass : inactiveClass}`}
          aria-current={isSettings ? "page" : undefined}
          aria-label="Settings"
          title={collapsed ? "Settings" : undefined}
        >
          <Settings className="size-4 shrink-0" />
          <span className={labelClass}>Settings</span>
        </Link>
      </div>
    </nav>
  );
}

export function AppShell({
  children,
  codexEnabled,
  counts,
  repositories,
}: {
  children: ReactNode;
  codexEnabled: boolean;
  counts: Counts;
  repositories: Repository[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`grid min-h-screen grid-cols-1 transition-[grid-template-columns] duration-200 ${collapsed ? "lg:grid-cols-[72px_1fr]" : "lg:grid-cols-[256px_1fr]"}`}
    >
      <aside
        className={`app-sidebar flex flex-col border-b px-4 py-4 transition-[padding] duration-200 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-y-auto lg:border-r lg:border-b-0 ${collapsed ? "lg:px-3" : ""}`}
      >
        <div
          className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}
        >
          <div
            className={`sidebar-logo grid size-9 shrink-0 place-items-center rounded-lg ${collapsed ? "lg:hidden" : ""}`}
          >
            <Image
              src="/mergetray-mark-paw.png"
              alt=""
              width={512}
              height={512}
              aria-hidden="true"
              className="size-8"
              priority
              unoptimized
            />
          </div>
          <div
            className={`min-w-0 leading-tight ${collapsed ? "lg:hidden" : ""}`}
          >
            <p className="truncate text-sm font-semibold text-[color:var(--sidebar-fg)]">
              MergeTray
            </p>
            <p className="truncate text-xs text-[color:var(--sidebar-muted)]">
              GitHub review queue
            </p>
          </div>
          <button
            type="button"
            className={`sidebar-control ml-auto hidden size-9 shrink-0 place-items-center rounded-lg lg:grid ${collapsed ? "lg:ml-0" : ""}`}
            aria-controls="app-sidebar-nav"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>
        <Suspense fallback={null}>
          <AppNav
            collapsed={collapsed}
            codexEnabled={codexEnabled}
            counts={counts}
            repositories={repositories}
          />
        </Suspense>
      </aside>
      <section className="min-w-0 bg-[var(--app-bg)]">{children}</section>
    </div>
  );
}
