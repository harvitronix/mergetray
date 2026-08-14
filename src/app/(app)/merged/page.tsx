import { ExternalLink, GitMerge } from "lucide-react";
import { AppPage, Surface } from "@/components/app-ui";
import { listRepositories, recentlyMerged } from "@/lib/inbox-store";

function mergedAgo(mergedAt: number) {
  const minutes = Math.max(1, Math.floor((Date.now() - mergedAt) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function RecentlyMergedPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const repo = (await searchParams).repo;
  const repositoryId = repo || undefined;
  const rows = recentlyMerged(repositoryId);
  const repositories = listRepositories();

  return (
    <AppPage>
      <Surface as="header" variant="toolbar" className="px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold leading-none tracking-normal">
              Recently merged
            </h1>
            <p className="mt-2 text-sm text-foreground/55">
              The latest 25 pull requests captured as they merge.
            </p>
          </div>
          <form className="flex items-end gap-2">
            <label className="grid gap-1 text-xs text-foreground/55">
              Repository
              <select
                name="repo"
                defaultValue={repositoryId ?? ""}
                className="app-inset-surface h-9 min-w-52 px-2.5 text-sm font-medium text-foreground outline-none"
              >
                <option value="">All repositories</option>
                {repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.fullName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-9 rounded-md bg-[var(--selected-control-bg)] px-3 text-sm font-semibold text-[var(--selected-control-fg)]"
            >
              Filter
            </button>
          </form>
        </div>
      </Surface>

      <Surface className="mt-4 overflow-hidden">
        {rows.length ? (
          <div className="divide-y divide-foreground/10">
            {rows.map(({ item, repository, pullRequestDetails }) => {
              const mergedAt = pullRequestDetails.mergedAt ?? item.closedAt;

              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-foreground/[0.03]"
                >
                  <GitMerge className="size-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-foreground/50">
                      {repository.fullName} #{item.number} by @
                      {item.authorLogin}
                    </p>
                  </div>
                  {mergedAt ? (
                    <time
                      dateTime={new Date(mergedAt).toISOString()}
                      className="shrink-0 text-xs text-foreground/50"
                    >
                      {mergedAgo(mergedAt)}
                    </time>
                  ) : null}
                  <ExternalLink className="size-3.5 shrink-0 text-foreground/35" />
                </a>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-12 text-center">
            <GitMerge className="mx-auto size-6 text-foreground/30" />
            <p className="mt-3 font-medium">No merged PRs captured yet.</p>
            <p className="mt-2 text-sm text-foreground/55">
              New merges will appear here after the next GitHub poll.
            </p>
          </div>
        )}
      </Surface>
    </AppPage>
  );
}
