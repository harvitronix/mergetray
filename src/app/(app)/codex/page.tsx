import { AppPage, Notice } from "@/components/app-ui";
import {
  type CodexThread,
  codexAppServer,
  codexThreadMessages,
} from "@/lib/codex-app-server";
import { inspectCodexCheckout } from "@/lib/codex-checkout";
import {
  codexCliVersion,
  codexIntegrationEnabled,
} from "@/lib/codex-integration";
import { codexSessionId } from "@/lib/codex-links";
import { codexRecoveryOption } from "@/lib/codex-worktrees";
import { CodexChat, type CodexInitialThread } from "./codex-chat";

function threadSummary(thread: CodexThread) {
  return {
    id: thread.id,
    title: thread.name || thread.preview.split("\n", 1)[0] || thread.id,
  };
}

export default async function CodexPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  if (!codexIntegrationEnabled()) {
    return (
      <AppPage>
        <Notice tone="warning">
          Enable the Codex integration in Settings to use Codex in MergeTray.
        </Notice>
      </AppPage>
    );
  }

  const version = await codexCliVersion();
  const threadParam = (await searchParams).thread;
  const requestedThreadId = codexSessionId(threadParam ?? "");
  const defaultCheckout = await inspectCodexCheckout({
    cwd: process.cwd(),
    gitInfo: null,
  });
  let initialError: string | undefined;
  let initialThread: CodexInitialThread | undefined;
  let initialThreads: Array<{ id: string; title: string }> = [];

  if (version) {
    try {
      const result = await codexAppServer.request<{ data: CodexThread[] }>(
        "thread/list",
        {
          limit: 20,
          sortKey: "updated_at",
          sortDirection: "desc",
          archived: false,
          useStateDbOnly: true,
        },
      );
      initialThreads = result.data.map(threadSummary);
    } catch (error) {
      initialError =
        error instanceof Error ? error.message : "Codex is unavailable.";
    }

    if (threadParam && !requestedThreadId) {
      initialError = "That Codex task link is invalid.";
    } else if (requestedThreadId) {
      try {
        const result = await codexAppServer.request<{ thread: CodexThread }>(
          "thread/read",
          { threadId: requestedThreadId, includeTurns: true },
        );
        initialThread = {
          id: result.thread.id,
          checkout: await inspectCodexCheckout(result.thread),
          messages: codexThreadMessages(result.thread),
        };
        if (!initialThread.checkout.available) {
          initialThread.recovery = await codexRecoveryOption(result.thread);
        }
        if (!initialThreads.some((thread) => thread.id === result.thread.id)) {
          initialThreads.unshift(threadSummary(result.thread));
        }
      } catch (error) {
        initialError =
          error instanceof Error ? error.message : "Codex task load failed.";
      }
    }
  }

  return (
    <AppPage className="h-screen min-h-0 overflow-hidden">
      {version ? (
        <CodexChat
          defaultCheckout={defaultCheckout}
          initialError={initialError}
          initialThread={initialThread}
          initialThreads={initialThreads}
          version={version}
        />
      ) : (
        <Notice tone="danger">
          Codex CLI was not found on the MergeTray server PATH.
        </Notice>
      )}
    </AppPage>
  );
}
