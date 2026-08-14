import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { Notice } from "@/components/app-ui";
import {
  githubDataRevision,
  githubSyncNeeded,
  githubSyncState,
} from "@/lib/github-sync";
import { inboxCounts, listRepositories } from "@/lib/inbox-store";
import { appTheme, themeCookieName } from "@/lib/theme";
import { AppNav } from "./app-nav";
import { BackgroundSync } from "./background-sync";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await connection();
  const theme = appTheme((await cookies()).get(themeCookieName)?.value);
  const counts = inboxCounts();
  const repositories = listRepositories();
  const syncState = githubSyncState();

  return (
    <main
      data-app-theme={theme}
      className="min-h-screen bg-background text-foreground"
    >
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[256px_1fr]">
        <aside className="app-sidebar flex flex-col border-b px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="sidebar-logo grid size-9 place-items-center rounded-lg">
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
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-[color:var(--sidebar-fg)]">
                MergeTray
              </p>
              <p className="truncate text-xs text-[color:var(--sidebar-muted)]">
                GitHub review queue
              </p>
            </div>
          </div>
          <Suspense fallback={null}>
            <AppNav counts={counts} repositories={repositories} />
          </Suspense>
        </aside>
        <section className="min-w-0 bg-[var(--app-bg)]">
          {syncState?.error ? (
            <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-5 lg:px-8">
              <Notice tone="danger">
                <strong>GitHub sync failed.</strong> {syncState.error} Timeline
                data may be stale.{" "}
                <Link className="font-semibold underline" href="/settings">
                  Review connection
                </Link>
              </Notice>
            </div>
          ) : null}
          {children}
        </section>
      </div>
      <BackgroundSync
        enabled={githubSyncNeeded()}
        githubRevision={githubDataRevision()}
      />
    </main>
  );
}
