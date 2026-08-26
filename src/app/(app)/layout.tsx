import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { setting } from "@/lib/database";
import { githubDataRevision, githubSyncNeeded } from "@/lib/github-sync";
import {
  inboxCounts,
  listInboxRows,
  listRepositories,
} from "@/lib/inbox-store";
import { appTheme, themeCookieName } from "@/lib/theme";
import { AppShell } from "./app-nav";
import { BackgroundSync } from "./background-sync";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await connection();
  const theme = appTheme((await cookies()).get(themeCookieName)?.value);
  const rows = listInboxRows();
  const counts = inboxCounts(rows);
  const repositories = listRepositories();

  return (
    <main
      data-app-theme={theme}
      className="min-h-screen bg-background text-foreground"
    >
      <AppShell counts={counts} repositories={repositories}>
        {children}
      </AppShell>
      <BackgroundSync
        enabled={githubSyncNeeded()}
        githubRevision={githubDataRevision()}
        webhooksEnabled={setting("github_webhooks_enabled") === "true"}
      />
    </main>
  );
}
