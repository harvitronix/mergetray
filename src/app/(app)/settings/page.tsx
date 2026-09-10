import {
  Bot,
  ExternalLink,
  FileX2,
  GitBranch,
  HardDrive,
  Terminal,
} from "lucide-react";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppPage, Notice, Surface } from "@/components/app-ui";
import {
  codexCliVersion,
  codexIntegrationEnabled,
  codexIntegrationSetting,
} from "@/lib/codex-integration";
import {
  cleanupCodexManagedWorktree,
  listCodexManagedWorktrees,
  setRepositoryLocalPath,
} from "@/lib/codex-worktrees";
import { setSetting, setting } from "@/lib/database";
import {
  diffFileFilters,
  diffFileFiltersSetting,
} from "@/lib/diff-file-filters";
import { githubAuthStatus } from "@/lib/github-auth";
import { githubSyncState, syncGithub } from "@/lib/github-sync";
import { githubIdentityConfigured, listRepositories } from "@/lib/inbox-store";
import { appTheme, themeCookieName } from "@/lib/theme";
import { CleanupWorktreeButton } from "./cleanup-worktree-button";
import { SectionRulesSettings } from "./section-rules-settings";
import { SyncButton } from "./sync-button";
import { ThemeSettingsForm } from "./theme-settings-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    syncFailed?: string;
    synced?: string;
    codexUpdated?: string;
    diffFiltersUpdated?: string;
    repositoryPathUpdated?: string;
    repositoryPathError?: string;
    worktreeCleaned?: string;
    worktreeCleanupError?: string;
  }>;
}) {
  const query = await searchParams;
  const theme = appTheme((await cookies()).get(themeCookieName)?.value);
  const [auth, repositories, codexVersion] = await Promise.all([
    githubAuthStatus(),
    Promise.resolve(listRepositories()),
    codexCliVersion(),
  ]);
  const codexEnabled = codexIntegrationEnabled();
  const managedWorktrees = await listCodexManagedWorktrees();
  const syncState = githubSyncState();

  async function syncNow() {
    "use server";

    try {
      await syncGithub(true);
    } catch {
      redirect("/settings?syncFailed=1");
    }
    revalidatePath("/", "layout");
    redirect("/settings?synced=1");
  }

  async function updateCodexIntegration(formData: FormData) {
    "use server";

    setSetting(
      codexIntegrationSetting,
      formData.get("enabled") === "true" ? "true" : undefined,
    );
    revalidatePath("/", "layout");
    redirect("/settings?codexUpdated=1");
  }

  async function updateDiffFileFilters(formData: FormData) {
    "use server";

    const filters = diffFileFilters(String(formData.get("filters") ?? ""));
    setSetting(
      diffFileFiltersSetting,
      filters.length ? filters.join("\n") : undefined,
    );
    revalidatePath("/", "layout");
    redirect("/settings?diffFiltersUpdated=1");
  }

  async function updateRepositoryPath(formData: FormData) {
    "use server";

    const repositoryId = String(formData.get("repositoryId") ?? "");
    const localPath = String(formData.get("localPath") ?? "");
    let error: string | undefined;
    try {
      await setRepositoryLocalPath(repositoryId, localPath);
    } catch (updateError) {
      error =
        updateError instanceof Error
          ? updateError.message
          : "Local checkout could not be saved.";
    }
    if (error) {
      redirect(`/settings?repositoryPathError=${encodeURIComponent(error)}`);
    }
    revalidatePath("/", "layout");
    redirect("/settings?repositoryPathUpdated=1");
  }

  async function cleanupWorktree(formData: FormData) {
    "use server";

    try {
      await cleanupCodexManagedWorktree(
        String(formData.get("worktreeId") ?? ""),
      );
    } catch (cleanupError) {
      const message =
        cleanupError instanceof Error
          ? cleanupError.message
          : "The managed worktree could not be cleaned up.";
      redirect(`/settings?worktreeCleanupError=${encodeURIComponent(message)}`);
    }
    revalidatePath("/", "layout");
    redirect("/settings?worktreeCleaned=1");
  }

  return (
    <AppPage>
      <Surface as="header" variant="toolbar" className="px-4 py-4 sm:px-5">
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">
          Settings
        </h1>
      </Surface>

      {!githubIdentityConfigured() ? (
        <Notice tone="warning" className="mt-4">
          Run <code>pnpm mergetray setup</code> to connect GitHub and choose
          repositories.
        </Notice>
      ) : null}

      <ThemeSettingsForm initialTheme={theme} />

      <Surface className="mt-4 p-5">
        <div className="flex items-center gap-3">
          <Surface
            as="span"
            variant="inset"
            className="grid size-10 place-items-center"
          >
            <FileX2 className="size-5" />
          </Surface>
          <div>
            <h2 className="text-lg font-semibold">Diff file filters</h2>
            <p className="text-sm text-foreground/55">
              Exclude generated files and tests from the reviewable change
              count. GitHub totals stay visible.
            </p>
          </div>
        </div>

        {query.diffFiltersUpdated ? (
          <Notice tone="success" className="mt-5">
            Diff file filters saved.
          </Notice>
        ) : null}

        <form action={updateDiffFileFilters} className="mt-5">
          <label className="grid gap-2 text-sm font-medium">
            Excluded file patterns
            <textarea
              name="filters"
              defaultValue={setting(diffFileFiltersSetting)}
              rows={6}
              placeholder={"**/__generated__/**\n*.generated.ts\n*.test.*"}
              className="min-h-32 resize-y rounded-md border border-foreground/10 bg-background px-3 py-2 font-mono text-sm"
            />
          </label>
          <p className="mt-2 text-xs text-foreground/50">
            Enter one glob per line. Patterns without a slash match file names
            in any folder. Use ** to match across folders. New file data appears
            after the next GitHub sync.
          </p>
          <button
            type="submit"
            className="mt-3 h-9 rounded-md bg-[var(--selected-control-bg)] px-3 text-xs font-semibold text-[var(--selected-control-fg)]"
          >
            Save filters
          </button>
        </form>
      </Surface>

      <SectionRulesSettings />

      <Surface className="mt-4 p-5">
        <div className="flex items-center gap-3">
          <Surface
            as="span"
            variant="inset"
            className="grid size-10 place-items-center"
          >
            <Bot className="size-5" />
          </Surface>
          <div>
            <h2 className="text-lg font-semibold">Codex integration</h2>
            <p className="text-sm text-foreground/55">
              Suggests and links local Codex tasks for matching pull requests.
            </p>
          </div>
        </div>

        {query.codexUpdated ? (
          <Notice tone="success" className="mt-5">
            Codex integration {codexEnabled ? "enabled" : "disabled"}.
          </Notice>
        ) : null}
        {query.repositoryPathUpdated ? (
          <Notice tone="success" className="mt-5">
            Local checkout saved.
          </Notice>
        ) : null}
        {query.repositoryPathError ? (
          <Notice tone="danger" className="mt-5">
            {query.repositoryPathError}
          </Notice>
        ) : null}
        {query.worktreeCleaned ? (
          <Notice tone="success" className="mt-5">
            The Codex task was archived and its managed worktree was removed.
          </Notice>
        ) : null}
        {query.worktreeCleanupError ? (
          <Notice tone="danger" className="mt-5">
            {query.worktreeCleanupError}
          </Notice>
        ) : null}

        <Surface variant="inset" className="mt-5 px-3 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {codexEnabled ? "Enabled" : "Disabled"}
              </p>
              <p className="mt-1 text-foreground/55">
                {codexVersion
                  ? `Codex CLI available · ${codexVersion}`
                  : "Codex CLI not found on the server PATH"}
              </p>
            </div>
            <form action={updateCodexIntegration}>
              <button
                type="submit"
                name="enabled"
                value={String(!codexEnabled)}
                disabled={!codexEnabled && !codexVersion}
                className="inline-flex h-9 items-center rounded-md bg-[var(--selected-control-bg)] px-3 text-xs font-semibold text-[var(--selected-control-fg)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {codexEnabled ? "Disable Codex" : "Enable Codex"}
              </button>
            </form>
          </div>
        </Surface>

        {repositories.length ? (
          <div className="mt-5 border-t border-foreground/10 pt-5">
            <h3 className="text-sm font-semibold">Local checkouts</h3>
            <p className="mt-1 text-sm text-foreground/55">
              MergeTray uses these repositories to create replacement worktrees
              for unavailable PR tasks.
            </p>
            <div className="mt-3 grid gap-3">
              {repositories.map((repository) => (
                <form
                  key={repository.id}
                  action={updateRepositoryPath}
                  className="app-inset-surface grid gap-2 px-3 py-3 sm:grid-cols-[minmax(10rem,0.45fr)_minmax(16rem,1fr)_auto] sm:items-end"
                >
                  <input
                    type="hidden"
                    name="repositoryId"
                    value={repository.id}
                  />
                  <div className="grid gap-1 text-xs font-medium">
                    Repository
                    <span className="h-9 truncate py-2 font-mono text-sm">
                      {repository.fullName}
                    </span>
                  </div>
                  <label className="grid gap-1 text-xs font-medium">
                    Local checkout path
                    <input
                      name="localPath"
                      defaultValue={repository.localPath ?? ""}
                      placeholder={`/path/to/${repository.name}`}
                      className="h-9 min-w-0 rounded-md border border-foreground/10 bg-background px-3 font-mono text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="h-9 rounded-md border border-foreground/10 bg-background/70 px-3 text-xs font-semibold"
                  >
                    Save
                  </button>
                </form>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 border-t border-foreground/10 pt-5">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4" />
            <h3 className="text-sm font-semibold">Managed worktrees</h3>
            <span className="text-xs text-foreground/45">
              {managedWorktrees.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground/55">
            MergeTray only removes clean worktrees that it created. Active,
            dirty, or unrecognized directories remain untouched.
          </p>
          {managedWorktrees.length ? (
            <div className="mt-3 grid gap-3">
              {managedWorktrees.map((worktree) => (
                <Surface
                  key={worktree.id}
                  variant="inset"
                  className="min-w-0 px-3 py-3"
                >
                  <div className="flex min-w-0 flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={worktree.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold"
                        >
                          <span className="truncate">
                            {worktree.repository}#{worktree.number}
                          </span>
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                        <span className="rounded-full border border-foreground/10 px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide text-foreground/55">
                          {worktree.cleanupState === "ready"
                            ? "Clean"
                            : worktree.cleanupState === "active"
                              ? "Task active"
                              : worktree.cleanupState === "dirty"
                                ? "Uncommitted changes"
                                : worktree.cleanupState === "missing"
                                  ? "Directory missing"
                                  : "Needs attention"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-foreground/60">
                        {worktree.title}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-foreground/45">
                        {worktree.path}
                      </p>
                      <p className="mt-1 text-xs text-foreground/45">
                        {worktree.branch} @ {worktree.sha.slice(0, 7)} ·{" "}
                        {worktree.pullRequestState} · created{" "}
                        {new Date(worktree.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-xs text-foreground/60">
                        {worktree.detail}
                      </p>
                    </div>
                    <form action={cleanupWorktree}>
                      <input
                        type="hidden"
                        name="worktreeId"
                        value={worktree.id}
                      />
                      <CleanupWorktreeButton disabled={!worktree.canCleanup} />
                    </form>
                  </div>
                </Surface>
              ))}
            </div>
          ) : (
            <p className="app-inset-surface mt-3 px-3 py-3 text-sm text-foreground/50">
              No managed Codex worktrees.
            </p>
          )}
        </div>
      </Surface>

      <Surface className="mt-4 p-5">
        <div className="flex items-center gap-3">
          <Surface
            as="span"
            variant="inset"
            className="grid size-10 place-items-center"
          >
            <GitBranch className="size-5" />
          </Surface>
          <div>
            <h2 className="text-lg font-semibold">GitHub polling</h2>
            <p className="text-sm text-foreground/55">
              Uses credentials from your local GitHub CLI login.
            </p>
          </div>
        </div>

        {query.synced ? (
          <Notice tone="success" className="mt-5">
            GitHub data synced.
          </Notice>
        ) : null}
        {query.syncFailed || syncState?.error ? (
          <Notice tone="danger" className="mt-5">
            {syncState?.error ?? "GitHub sync failed."}
          </Notice>
        ) : null}

        <Surface variant="inset" className="mt-5 px-3 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {auth
                  ? `Authenticated${setting("github_login") ? ` as ${setting("github_login")}` : ""}`
                  : "GitHub CLI is not authenticated"}
              </p>
              <p className="mt-1 text-foreground/55">
                {repositories.length} selected repositories
                {syncState?.last_completed_at
                  ? ` · Last synced ${new Date(syncState.last_completed_at).toLocaleString()}`
                  : " · Not synced yet"}
              </p>
            </div>
            <form action={syncNow}>
              <SyncButton />
            </form>
          </div>
          {repositories.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {repositories.map((repository) => (
                <span
                  key={repository.id}
                  className="pill-muted inline-flex h-7 items-center rounded-full border border-foreground/10 px-2.5 font-mono text-xs text-foreground/70"
                >
                  {repository.fullName}
                </span>
              ))}
            </div>
          ) : null}
        </Surface>

        <div className="mt-5 flex items-start gap-3 border-t border-foreground/10 pt-5 text-sm">
          <Terminal className="mt-0.5 size-4 shrink-0 text-foreground/45" />
          <p className="text-foreground/60">
            Run <code>pnpm mergetray setup</code> again to add repositories, or{" "}
            <code>pnpm mergetray doctor</code> to diagnose the local setup.
          </p>
        </div>
      </Surface>
    </AppPage>
  );
}
