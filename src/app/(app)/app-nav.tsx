"use client";

import {
  ChevronDown,
  GitMerge,
  GitPullRequest,
  Inbox,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

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

function CountBadge({ value }: { value: number }) {
  if (value === 0) return null;

  return (
    <span className="sidebar-count ml-auto rounded-full px-2 py-0.5 text-xs font-medium">
      {value}
    </span>
  );
}

export function AppNav({
  counts,
  repositories,
}: {
  counts: Counts;
  repositories: Repository[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedRepositoryId = searchParams.get("repo");
  const isSettings = pathname.startsWith("/settings");
  const isRecentlyMerged = pathname.startsWith("/merged");
  const isInbox = pathname === "/" || pathname.startsWith("/inbox");
  const repositoryCounts = new Map(
    counts.repositories.map(({ repositoryId, active }) => [
      repositoryId,
      active,
    ]),
  );

  return (
    <nav className="mt-6 flex flex-1 flex-col gap-5 text-sm">
      <div className="grid gap-1">
        <p className="mb-1 px-2.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[color:var(--sidebar-muted)]">
          Workspace
        </p>
        <Link
          href="/inbox"
          className={`${baseClass} ${isInbox && !selectedRepositoryId ? activeClass : inactiveClass}`}
          aria-current={isInbox && !selectedRepositoryId ? "page" : undefined}
        >
          <Inbox className="size-4" />
          Inbox
          <CountBadge value={counts.all} />
        </Link>
        <Link
          href="/merged"
          className={`${baseClass} ${isRecentlyMerged ? activeClass : inactiveClass}`}
          aria-current={isRecentlyMerged ? "page" : undefined}
        >
          <GitMerge className="size-4" />
          Recently merged
        </Link>
      </div>
      <details className="group grid gap-1" open>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[color:var(--sidebar-muted)]">
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
                className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
                aria-current={isActive ? "page" : undefined}
                title={repository.fullName}
              >
                <GitPullRequest className="size-3.5 shrink-0" />
                <span className="block min-w-0 truncate">
                  {repository.name}
                </span>
                <CountBadge value={repositoryCounts.get(repository.id) ?? 0} />
              </Link>
            );
          })}
        </div>
      </details>
      <div className="sidebar-divider mt-auto grid gap-1 border-t pt-3">
        <Link
          href="/settings"
          className={`${baseClass} ${isSettings ? activeClass : inactiveClass}`}
          aria-current={isSettings ? "page" : undefined}
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </div>
    </nav>
  );
}
