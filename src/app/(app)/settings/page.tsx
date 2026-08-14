import { Bot, GitBranch, Terminal } from "lucide-react";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppPage, Notice, Surface } from "@/components/app-ui";
import {
  codexCliVersion,
  codexIntegrationEnabled,
  codexIntegrationSetting,
} from "@/lib/codex-integration";
import { setSetting, setting } from "@/lib/database";
import { githubAuthStatus } from "@/lib/github-auth";
import { githubSyncState, syncGithub } from "@/lib/github-sync";
import { githubIdentityConfigured, listRepositories } from "@/lib/inbox-store";
import { appTheme, themeCookieName } from "@/lib/theme";
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
