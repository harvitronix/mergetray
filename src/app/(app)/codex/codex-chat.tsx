"use client";

import {
  type AppendMessage,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  type ThreadMessageLike,
  ThreadPrimitive,
  useAuiState,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import {
  Bot,
  Brain,
  Check,
  ChevronRight,
  CircleCheck,
  FileDiff,
  GitFork,
  LoaderCircle,
  Send,
  ShieldCheck,
  ShieldQuestion,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import remarkGfm from "remark-gfm";
import { Notice, Surface } from "@/components/app-ui";
import type { CodexChatMessage } from "@/lib/codex-app-server";
import type { CodexCheckout } from "@/lib/codex-checkout";
import type { CodexRecoveryOption } from "@/lib/codex-worktrees";

type ChatMessage = ThreadMessageLike & { id: string };
type MessageKind = "message" | "reasoning";
type MessagePhase = "commentary" | "final_answer" | null;
type ThreadSummary = { id: string; title: string };
export type CodexInitialThread = {
  id: string;
  checkout: CodexCheckout;
  messages: CodexChatMessage[];
  recovery?: CodexRecoveryOption;
};
type Activity = {
  id: string;
  kind: "command" | "fileChange";
  title: string;
  detail?: string | null;
  status: string;
};
type Approval = {
  requestId: string | number;
  itemId: string;
  kind: "command" | "fileChange";
  command?: string;
  reason?: string;
};

type StreamEvent =
  | {
      type: "thread";
      threadId: string;
      checkout: CodexCheckout;
      messages: CodexChatMessage[];
      recovery?: CodexRecoveryOption;
    }
  | { type: "turn"; threadId: string; turnId: string }
  | {
      type: "assistantItemStarted";
      itemId: string;
      kind: MessageKind;
      phase?: MessagePhase;
    }
  | { type: "assistantItemDelta"; itemId: string; delta: string }
  | {
      type: "assistantItemCompleted";
      itemId: string;
      kind: MessageKind;
      phase?: MessagePhase;
      text: string;
    }
  | { type: "activity"; activity: Activity }
  | { type: "activityDelta"; itemId: string; delta: string }
  | ({ type: "approval" } & Approval)
  | { type: "diff"; diff: string }
  | { type: "completed"; status: string; error?: string }
  | { type: "error"; message: string };

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex min-w-0 justify-end">
      <div className="min-w-0 max-w-[85%] [overflow-wrap:anywhere] rounded-xl bg-[var(--selected-control-bg)] px-4 py-3 text-sm text-[var(--selected-control-fg)]">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="codex-markdown"
    />
  );
}

function AssistantMessage() {
  const kind = useAuiState(
    (state) => state.message.metadata.custom.kind as MessageKind | undefined,
  );
  const phase = useAuiState(
    (state) => state.message.metadata.custom.phase as MessagePhase | undefined,
  );
  const isRunning = useAuiState(
    (state) => state.message.status?.type === "running",
  );
  const isProgress = kind === "reasoning" || phase === "commentary";

  if (isProgress) {
    return (
      <MessagePrimitive.Root className="min-w-0">
        <details className="group min-w-0 rounded-md border border-foreground/10 bg-background/45 px-3 py-2 text-sm text-foreground/60">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground/55">
            {kind === "reasoning" ? (
              <Brain className="size-3.5" />
            ) : (
              <Bot className="size-3.5" />
            )}
            {kind === "reasoning" ? "Reasoning" : "Progress update"}
            {isRunning ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : null}
            <ChevronRight className="ml-auto size-3.5 transition group-open:rotate-90" />
          </summary>
          <div className="mt-2 border-t border-foreground/10 pt-2 text-foreground/70">
            <MessagePrimitive.Content components={{ Text: MarkdownText }} />
          </div>
        </details>
      </MessagePrimitive.Root>
    );
  }

  return (
    <MessagePrimitive.Root className="flex min-w-0 gap-3">
      <span className="app-inset-surface grid size-8 shrink-0 place-items-center">
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 flex-1 py-1 text-sm leading-6">
        <MessagePrimitive.Content components={{ Text: MarkdownText }} />
      </div>
    </MessagePrimitive.Root>
  );
}

async function readEventStream(
  response: Response,
  receive: (event: StreamEvent) => void,
) {
  if (!response.ok || !response.body) {
    const result = (await response.json().catch(() => undefined)) as
      | { error?: string }
      | undefined;
    throw new Error(result?.error ?? "Codex turn failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      if (data) receive(JSON.parse(data) as StreamEvent);
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function messageText(message: AppendMessage) {
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function chatMessage(message: CodexChatMessage, running = false): ChatMessage {
  return {
    ...message,
    metadata:
      message.role === "assistant"
        ? {
            custom: {
              kind: message.kind ?? "message",
              phase: message.phase ?? null,
            },
          }
        : undefined,
    status:
      message.role === "assistant"
        ? running
          ? { type: "running" }
          : { type: "complete", reason: "stop" }
        : undefined,
  };
}

function chatMessageText(message: ChatMessage) {
  return typeof message.content === "string" ? message.content : "";
}

function chatMessageMetadata(message: ChatMessage) {
  return {
    kind:
      (message.metadata?.custom?.kind as MessageKind | undefined) ?? "message",
    phase:
      (message.metadata?.custom?.phase as MessagePhase | undefined) ?? null,
  };
}

function appendAssistantDelta(message: ChatMessage, delta: string) {
  return chatMessage(
    {
      id: message.id,
      role: "assistant",
      content: `${chatMessageText(message)}${delta}`,
      ...chatMessageMetadata(message),
    },
    true,
  );
}

export function CodexChat({
  defaultCheckout,
  initialError,
  initialThread,
  initialThreads,
  version,
}: {
  defaultCheckout: CodexCheckout;
  initialError?: string;
  initialThread?: CodexInitialThread;
  initialThreads: ThreadSummary[];
  version: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    (initialThread?.messages ?? []).map((message) => chatMessage(message)),
  );
  const [threads, setThreads] = useState<ThreadSummary[]>(initialThreads);
  const [threadId, setThreadId] = useState<string | undefined>(
    initialThread?.id,
  );
  const [checkout, setCheckout] = useState<CodexCheckout | undefined>(
    initialThread?.checkout ?? defaultCheckout,
  );
  const [recovery, setRecovery] = useState<CodexRecoveryOption | undefined>(
    initialThread?.recovery,
  );
  const [turnId, setTurnId] = useState<string>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [approval, setApproval] = useState<Approval>();
  const [diff, setDiff] = useState("");
  const [error, setError] = useState<string | undefined>(initialError);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [turnStatus, setTurnStatus] = useState<
    | "ready"
    | "running"
    | "awaitingApproval"
    | "approvalDeclined"
    | "completed"
    | "incomplete"
    | "interrupted"
    | "failed"
  >("ready");

  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true);
    try {
      const response = await fetch("/api/codex");
      const result = (await response.json()) as {
        threads?: ThreadSummary[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setThreads(result.threads ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Codex is unavailable.",
      );
    } finally {
      setIsLoadingThreads(false);
    }
  }, []);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const prompt = messageText(message).trim();
      if (!prompt || !checkout?.available) return;

      const userMessage = chatMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
      });
      setMessages((current) => [...current, userMessage]);
      setActivities([]);
      setApproval(undefined);
      setDiff("");
      setError(undefined);
      setIsRunning(true);
      setTurnStatus("running");
      let sawTerminalEvent = false;
      let sawFinalAnswer = false;

      const receive = (event: StreamEvent) => {
        if (event.type === "thread") {
          setThreadId(event.threadId);
          setCheckout(event.checkout);
          setRecovery(event.recovery);
          setMessages([
            ...event.messages.map((item) => chatMessage(item)),
            userMessage,
          ]);
        } else if (event.type === "turn") {
          setTurnId(event.turnId);
        } else if (event.type === "assistantItemStarted") {
          if (event.phase === "final_answer") sawFinalAnswer = true;
          setMessages((current) => [
            ...current,
            chatMessage(
              {
                id: event.itemId,
                role: "assistant",
                content: "",
                kind: event.kind,
                phase: event.phase,
              },
              true,
            ),
          ]);
        } else if (event.type === "assistantItemDelta") {
          setMessages((current) => {
            const existing = current.find((item) => item.id === event.itemId);
            if (!existing) {
              return [
                ...current,
                chatMessage(
                  {
                    id: event.itemId,
                    role: "assistant",
                    content: event.delta,
                  },
                  true,
                ),
              ];
            }
            return current.map((item) =>
              item.id === event.itemId
                ? appendAssistantDelta(item, event.delta)
                : item,
            );
          });
        } else if (event.type === "assistantItemCompleted") {
          if (event.phase === "final_answer") sawFinalAnswer = true;
          setMessages((current) => {
            const message = chatMessage({
              id: event.itemId,
              role: "assistant",
              content: event.text,
              kind: event.kind,
              phase: event.phase,
            });
            return current.some((item) => item.id === event.itemId)
              ? current.map((item) =>
                  item.id === event.itemId ? message : item,
                )
              : [...current, message];
          });
        } else if (event.type === "activity") {
          if (event.activity.status === "inProgress") {
            setTurnStatus("running");
          }
          setActivities((current) => [
            ...current.filter((item) => item.id !== event.activity.id),
            event.activity,
          ]);
        } else if (event.type === "activityDelta") {
          setActivities((current) =>
            current.map((item) =>
              item.id === event.itemId
                ? { ...item, detail: `${item.detail ?? ""}${event.delta}` }
                : item,
            ),
          );
        } else if (event.type === "approval") {
          setApproval(event);
          setTurnStatus("awaitingApproval");
        } else if (event.type === "diff") {
          setDiff(event.diff);
        } else if (event.type === "completed") {
          sawTerminalEvent = true;
          const isIncomplete = event.status === "completed" && !sawFinalAnswer;
          setIsRunning(false);
          setTurnStatus(
            isIncomplete
              ? "incomplete"
              : event.status === "interrupted"
                ? "interrupted"
                : event.status === "failed"
                  ? "failed"
                  : "completed",
          );
          setApproval(undefined);
          if (isIncomplete) {
            setError(
              "Codex stopped after a progress update without completing its response.",
            );
          } else if (event.error) {
            setError(event.error);
          }
          setMessages((current) =>
            current.map((item) =>
              item.role === "assistant" && item.status?.type === "running"
                ? chatMessage(
                    {
                      id: item.id,
                      role: "assistant",
                      content: chatMessageText(item),
                      ...chatMessageMetadata(item),
                    },
                    false,
                  )
                : item,
            ),
          );
          void loadThreads();
        } else if (event.type === "error") {
          sawTerminalEvent = true;
          setError(event.message);
          setIsRunning(false);
          setTurnStatus("failed");
        }
      };

      try {
        await readEventStream(
          await fetch("/api/codex", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "turn",
              prompt,
              threadId,
            }),
          }),
          receive,
        );
        if (!sawTerminalEvent) {
          throw new Error(
            "The Codex event stream ended before the turn completed.",
          );
        }
      } catch (turnError) {
        setError(
          turnError instanceof Error ? turnError.message : "Codex turn failed.",
        );
        setIsRunning(false);
        setTurnStatus("failed");
      }
    },
    [checkout?.available, loadThreads, threadId],
  );

  const onCancel = useCallback(async () => {
    if (!threadId || !turnId) return;
    await fetch("/api/codex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "interrupt", threadId, turnId }),
    });
  }, [threadId, turnId]);

  const runtime = useExternalStoreRuntime<ChatMessage>({
    messages,
    setMessages: (next) => setMessages([...next]),
    isRunning,
    onNew,
    onCancel,
    convertMessage: (message) => message,
  });

  async function selectThread(id: string) {
    setThreadId(id || undefined);
    setCheckout(id ? undefined : defaultCheckout);
    setRecovery(undefined);
    setMessages([]);
    setActivities([]);
    setApproval(undefined);
    setDiff("");
    setError(undefined);
    setTurnStatus("ready");
    if (!id) {
      setIsLoadingThread(false);
      return;
    }

    setIsLoadingThread(true);
    try {
      const response = await fetch(
        `/api/codex?threadId=${encodeURIComponent(id)}`,
      );
      const result = (await response.json()) as {
        checkout: CodexCheckout;
        messages?: CodexChatMessage[];
        recovery?: CodexRecoveryOption;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setCheckout(result.checkout);
      setRecovery(result.recovery);
      setMessages((result.messages ?? []).map((item) => chatMessage(item)));
      window.history.replaceState(
        null,
        "",
        `/codex?thread=${encodeURIComponent(id)}`,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Task load failed.",
      );
    } finally {
      setIsLoadingThread(false);
    }
  }

  async function recoverThread() {
    if (!threadId || !recovery?.available) return;
    setIsRecovering(true);
    setError(undefined);
    try {
      const response = await fetch("/api/codex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recover", threadId }),
      });
      const result = (await response.json()) as {
        threadId?: string;
        error?: string;
      };
      if (!response.ok || !result.threadId) {
        throw new Error(result.error ?? "Task recovery failed.");
      }
      await selectThread(result.threadId);
      await loadThreads();
    } catch (recoveryError) {
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : "Task recovery failed.",
      );
    } finally {
      setIsRecovering(false);
    }
  }

  async function respondToApproval(
    decision: "accept" | "acceptForSession" | "decline",
  ) {
    if (!approval) return;
    const response = await fetch("/api/codex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approval",
        requestId: approval.requestId,
        decision,
      }),
    });
    if (!response.ok) {
      setError("The approval response failed.");
      return;
    }
    setApproval(undefined);
    if (decision === "decline") {
      setActivities((current) =>
        current.map((item) =>
          item.id === approval.itemId ? { ...item, status: "declined" } : item,
        ),
      );
      setTurnStatus("approvalDeclined");
    } else {
      setTurnStatus("running");
    }
  }

  const turnStatusLabel = {
    ready: "Ready",
    running: "Codex is working",
    awaitingApproval: "Waiting for approval",
    approvalDeclined: "Approval declined",
    completed: "Turn complete",
    incomplete: "Turn incomplete",
    interrupted: "Turn stopped",
    failed: "Turn failed",
  }[turnStatus];
  const checkoutKind =
    checkout?.kind === "worktree"
      ? "Worktree"
      : checkout?.kind === "primary"
        ? "Primary checkout"
        : "Checkout unavailable";
  const checkoutGit =
    checkout?.branch ??
    (checkout?.sha
      ? `detached @ ${checkout.sha.slice(0, 7)}`
      : "Git unavailable");
  const canSend =
    checkout?.available === true && !isLoadingThread && !isRecovering;

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-x-hidden overflow-y-auto xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] xl:overflow-hidden">
      <Surface className="flex min-h-[36rem] min-w-0 flex-col overflow-hidden xl:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Codex</p>
            <p className="truncate text-xs font-medium text-foreground/65">
              {checkout
                ? `${checkout.project} · ${checkoutKind} · ${checkoutGit}`
                : "Inspecting checkout…"}
            </p>
            <p className="truncate text-xs text-foreground/40">
              {version} · {checkout?.cwd ?? "Loading checkout…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 text-xs font-medium text-[var(--success-text)]"
              title="Codex automatically reviews approval requests"
            >
              <ShieldCheck className="size-3.5" />
              Auto-review on
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-foreground/10 px-2.5 text-xs font-medium text-foreground/60">
              {turnStatus === "running" ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : turnStatus === "awaitingApproval" ? (
                <ShieldQuestion className="size-3.5 text-[var(--warning-text)]" />
              ) : turnStatus === "completed" ? (
                <CircleCheck className="size-3.5 text-[var(--success-text)]" />
              ) : turnStatus === "approvalDeclined" ||
                turnStatus === "failed" ||
                turnStatus === "incomplete" ? (
                <X className="size-3.5 text-[var(--danger-text)]" />
              ) : null}
              {turnStatusLabel}
            </span>
            <select
              value={threadId ?? ""}
              disabled={isRunning || isLoadingThread || isLoadingThreads}
              onChange={(event) => void selectThread(event.target.value)}
              className="h-9 max-w-72 rounded-md border border-foreground/10 bg-transparent px-2.5 text-sm"
              aria-label="Codex task"
            >
              <option value="">New task</option>
              {threads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  {thread.title || thread.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <Notice tone="danger" className="mx-4 mt-4">
            {error}
          </Notice>
        ) : null}

        {checkout && !checkout.available ? (
          <Notice tone="danger" className="mx-4 mt-4">
            <p>
              {checkout.reason} Input is disabled until the checkout is
              available again.
            </p>
            {recovery?.available ? (
              <button
                type="button"
                disabled={isRecovering}
                onClick={() => void recoverThread()}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--selected-control-bg)] px-3 text-xs font-semibold text-[var(--selected-control-fg)] disabled:opacity-50"
              >
                {isRecovering ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <GitFork className="size-3.5" />
                )}
                {isRecovering
                  ? "Creating worktree…"
                  : "Continue in new worktree"}
              </button>
            ) : recovery ? (
              <p className="mt-2 text-sm">
                {recovery.reason} <a href="/settings">Open Settings</a>
              </p>
            ) : null}
          </Notice>
        ) : null}

        <AssistantRuntimeProvider key={threadId ?? "new"} runtime={runtime}>
          <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
            <ThreadPrimitive.Viewport
              autoScroll
              scrollToBottomOnInitialize
              scrollToBottomOnRunStart
              scrollToBottomOnThreadSwitch
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto py-5 pl-4 pr-[36px]"
            >
              <ThreadPrimitive.Empty>
                <div className="m-auto max-w-md py-16 text-center">
                  <Bot className="mx-auto size-8 text-foreground/35" />
                  <p className="mt-3 font-semibold">Start a Codex task</p>
                  <p className="mt-1 text-sm text-foreground/50">
                    Ask a question, run a command, or request a tiny file
                    change.
                  </p>
                </div>
              </ThreadPrimitive.Empty>
              <div className="grid min-w-0 gap-5">
                <ThreadPrimitive.Messages
                  components={{ UserMessage, AssistantMessage }}
                />
              </div>
              <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto pt-5">
                <ComposerPrimitive.Root className="app-inset-surface flex items-end gap-2 p-2 shadow-sm">
                  <ComposerPrimitive.Input
                    disabled={!canSend}
                    placeholder={
                      canSend
                        ? "Ask Codex to inspect or change this repo…"
                        : "Checkout unavailable"
                    }
                    rows={1}
                    className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {isRunning ? (
                    <ComposerPrimitive.Cancel className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--selected-control-bg)] text-[var(--selected-control-fg)]">
                      <Square className="size-4" />
                    </ComposerPrimitive.Cancel>
                  ) : (
                    <ComposerPrimitive.Send
                      disabled={!canSend}
                      className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--selected-control-bg)] text-[var(--selected-control-fg)] disabled:opacity-40"
                    >
                      <Send className="size-4" />
                    </ComposerPrimitive.Send>
                  )}
                </ComposerPrimitive.Root>
              </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
          </ThreadPrimitive.Root>
        </AssistantRuntimeProvider>
      </Surface>

      <div className="grid min-w-0 content-start gap-4 xl:h-full xl:min-h-0 xl:overflow-y-auto">
        {approval ? (
          <Surface className="border-amber-500/35 p-4">
            <div className="flex items-start gap-3">
              <ShieldQuestion className="mt-0.5 size-5 shrink-0 text-[var(--warning-text)]" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Approval required</p>
                <p className="mt-1 text-sm text-foreground/55">
                  {approval.reason ??
                    (approval.kind === "fileChange"
                      ? "Codex wants to change files."
                      : "Codex wants to run a command outside the sandbox.")}
                </p>
                {approval.command ? (
                  <code className="mt-3 block overflow-x-auto rounded-md bg-background p-2 text-xs">
                    {approval.command}
                  </code>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void respondToApproval("accept")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--selected-control-bg)] px-3 text-xs font-semibold text-[var(--selected-control-fg)]"
                  >
                    <Check className="size-3.5" />
                    Approve once
                  </button>
                  <button
                    type="button"
                    onClick={() => void respondToApproval("acceptForSession")}
                    className="h-9 rounded-md border border-foreground/10 px-3 text-xs font-semibold"
                  >
                    Approve for task
                  </button>
                  <button
                    type="button"
                    onClick={() => void respondToApproval("decline")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-foreground/10 px-3 text-xs font-semibold"
                  >
                    <X className="size-3.5" />
                    Decline
                  </button>
                </div>
              </div>
            </div>
          </Surface>
        ) : null}

        <Surface className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Terminal className="size-4" />
              Activity
            </h2>
            {isRunning ? (
              <LoaderCircle className="size-4 animate-spin text-foreground/45" />
            ) : null}
          </div>
          {activities.length ? (
            <div className="mt-3 grid gap-2">
              {activities.map((item) => (
                <Surface key={item.id} variant="inset" className="p-3">
                  <div className="flex items-start gap-2">
                    {item.kind === "command" ? (
                      <Terminal className="mt-0.5 size-3.5 shrink-0" />
                    ) : (
                      <FileDiff className="mt-0.5 size-3.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-mono text-xs">
                        {item.title || "File change"}
                      </p>
                      <p className="mt-1 text-[0.68rem] uppercase tracking-wide text-foreground/40">
                        {item.status}
                      </p>
                    </div>
                  </div>
                  {item.detail ? (
                    <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs">
                      {item.detail}
                    </pre>
                  ) : null}
                </Surface>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-foreground/45">
              Commands and file changes will appear here.
            </p>
          )}
        </Surface>

        <Surface className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileDiff className="size-4" />
            Turn diff
          </h2>
          {diff ? (
            <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs leading-5">
              {diff}
            </pre>
          ) : (
            <p className="mt-3 text-sm text-foreground/45">
              The live aggregated diff will appear after Codex proposes a file
              change.
            </p>
          )}
        </Surface>
      </div>
    </div>
  );
}
