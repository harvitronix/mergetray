import {
  type CodexThread,
  type CodexThreadItem,
  codexAppServer,
  codexThreadMessages,
} from "@/lib/codex-app-server";
import { inspectCodexCheckout } from "@/lib/codex-checkout";
import { codexIntegrationEnabled } from "@/lib/codex-integration";
import {
  codexRecoveryOption,
  createCodexThreadForInboxItem,
  recoverCodexThread,
} from "@/lib/codex-worktrees";
import { isLocalRequest } from "@/lib/local-request";

export const dynamic = "force-dynamic";

const cwd = process.cwd();
const encoder = new TextEncoder();

function threadSummary(thread: CodexThread) {
  return {
    id: thread.id,
    title: thread.name || thread.preview.split("\n", 1)[0] || thread.id,
  };
}

function accessAllowed(request: Request) {
  return isLocalRequest(request) && codexIntegrationEnabled();
}

function eventData(
  controller: ReadableStreamDefaultController,
  value: unknown,
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
}

function activity(item: CodexThreadItem) {
  if (item.type === "commandExecution") {
    return {
      id: item.id,
      kind: "command",
      title: item.command,
      detail: item.aggregatedOutput,
      status: item.status,
    };
  }
  if (item.type === "fileChange") {
    return {
      id: item.id,
      kind: "fileChange",
      title: item.changes.map((change) => change.path).join(", "),
      status: item.status,
    };
  }
}

export async function GET(request: Request) {
  if (!accessAllowed(request)) return new Response(null, { status: 403 });

  const threadId = new URL(request.url).searchParams.get("threadId");
  try {
    if (threadId) {
      const result = await codexAppServer.request<{ thread: CodexThread }>(
        "thread/read",
        { threadId, includeTurns: true },
      );
      const checkout = await inspectCodexCheckout(result.thread);
      return Response.json({
        checkout,
        messages: codexThreadMessages(result.thread),
        recovery: checkout.available
          ? undefined
          : await codexRecoveryOption(result.thread),
      });
    }

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
    return Response.json({ threads: result.data.map(threadSummary) });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Codex is unavailable.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!accessAllowed(request)) return new Response(null, { status: 403 });

  const body = (await request.json().catch(() => undefined)) as
    | {
        action?: "turn" | "approval" | "interrupt" | "recover";
        prompt?: string;
        inboxItemId?: string;
        threadId?: string;
        turnId?: string;
        requestId?: string | number;
        decision?: "accept" | "acceptForSession" | "decline";
      }
    | undefined;

  if (body?.action === "approval") {
    if (body.requestId === undefined || !body.decision) {
      return Response.json({ error: "Invalid approval." }, { status: 400 });
    }
    await codexAppServer.respond(body.requestId, { decision: body.decision });
    return Response.json({ ok: true });
  }

  if (body?.action === "interrupt") {
    if (!body.threadId || !body.turnId) {
      return Response.json({ error: "Invalid turn." }, { status: 400 });
    }
    await codexAppServer.request("turn/interrupt", {
      threadId: body.threadId,
      turnId: body.turnId,
    });
    return Response.json({ ok: true });
  }

  if (body?.action === "recover") {
    if (!body.threadId) {
      return Response.json({ error: "Invalid task." }, { status: 400 });
    }
    try {
      const result = await codexAppServer.request<{ thread: CodexThread }>(
        "thread/read",
        { threadId: body.threadId, includeTurns: true },
      );
      const checkout = await inspectCodexCheckout(result.thread);
      if (checkout.available) {
        return Response.json(
          { error: "This task's checkout is already available." },
          { status: 409 },
        );
      }
      return Response.json(await recoverCodexThread(result.thread));
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "Task recovery failed.",
        },
        { status: 500 },
      );
    }
  }

  if (body?.action !== "turn" || !body.prompt?.trim()) {
    return Response.json({ error: "A prompt is required." }, { status: 400 });
  }
  const prompt = body.prompt.trim();

  const stream = new ReadableStream({
    start(controller) {
      let activeThreadId = body.threadId;
      let activeTurnId: string | undefined;
      let unsubscribe = () => {};
      let finished = false;
      let idleTimer: ReturnType<typeof setTimeout> | undefined;

      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(idleTimer);
        unsubscribe();
        controller.close();
      };

      const complete = (status: string, error?: string) => {
        if (finished) return;
        eventData(controller, { type: "completed", status, error });
        finish();
      };

      unsubscribe = codexAppServer.subscribe((message) => {
        const params = message.params;
        if (!params || params.threadId !== activeThreadId) return;
        if (activeTurnId && params.turnId && params.turnId !== activeTurnId) {
          return;
        }

        if (message.method === "thread/status/changed" && activeTurnId) {
          const status = params.status as { type: string };
          if (status.type === "systemError") {
            complete("failed", "The Codex task stopped unexpectedly.");
          } else if (status.type === "idle") {
            idleTimer = setTimeout(() => complete("completed"), 100);
          }
          return;
        }

        if (
          message.method === "item/commandExecution/requestApproval" ||
          message.method === "item/fileChange/requestApproval"
        ) {
          if (message.id === undefined) return;
          eventData(controller, {
            type: "approval",
            requestId: message.id,
            itemId: params.itemId,
            kind: message.method.includes("commandExecution")
              ? "command"
              : "fileChange",
            command: params.command,
            reason: params.reason,
          });
          return;
        }

        if (message.method === "item/agentMessage/delta") {
          eventData(controller, {
            type: "assistantItemDelta",
            itemId: params.itemId,
            delta: params.delta,
          });
          return;
        }

        if (message.method === "item/reasoning/summaryTextDelta") {
          eventData(controller, {
            type: "assistantItemDelta",
            itemId: params.itemId,
            delta: params.delta,
          });
          return;
        }

        if (
          message.method === "item/started" ||
          message.method === "item/completed"
        ) {
          const item = params.item as CodexThreadItem;
          if (item.type === "agentMessage" || item.type === "reasoning") {
            const kind = item.type === "reasoning" ? "reasoning" : "message";
            if (message.method === "item/started") {
              eventData(controller, {
                type: "assistantItemStarted",
                itemId: item.id,
                kind,
                phase: item.type === "agentMessage" ? item.phase : undefined,
              });
            } else {
              eventData(controller, {
                type: "assistantItemCompleted",
                itemId: item.id,
                kind,
                phase: item.type === "agentMessage" ? item.phase : undefined,
                text:
                  item.type === "agentMessage"
                    ? item.text
                    : item.summary.join("\n\n"),
              });
            }
          }
          const nextActivity = activity(item);
          if (nextActivity) {
            eventData(controller, { type: "activity", activity: nextActivity });
          }
          return;
        }

        if (message.method === "item/commandExecution/outputDelta") {
          eventData(controller, {
            type: "activityDelta",
            itemId: params.itemId,
            delta: params.delta,
          });
          return;
        }

        if (message.method === "turn/diff/updated") {
          eventData(controller, { type: "diff", diff: params.diff });
          return;
        }

        if (message.method === "turn/completed") {
          const turn = params.turn as {
            status: string;
            error?: { message?: string } | null;
          };
          complete(turn.status, turn.error?.message);
        }
      });

      request.signal.addEventListener("abort", unsubscribe, { once: true });

      void (async () => {
        try {
          const result = activeThreadId
            ? await codexAppServer.request<{ thread: CodexThread }>(
                "thread/resume",
                { threadId: activeThreadId },
              )
            : body.inboxItemId
              ? await createCodexThreadForInboxItem(body.inboxItemId, (stage) =>
                  eventData(controller, { type: "setup", stage }),
                )
              : await codexAppServer.request<{ thread: CodexThread }>(
                  "thread/start",
                  {
                    cwd,
                    approvalPolicy: "on-request",
                    sandbox: "read-only",
                    serviceName: "mergetray",
                  },
                );
          activeThreadId = result.thread.id;
          const checkout = await inspectCodexCheckout(result.thread);
          eventData(controller, {
            type: "thread",
            threadId: activeThreadId,
            checkout,
            messages: codexThreadMessages(result.thread),
            recovery: checkout.available
              ? undefined
              : await codexRecoveryOption(result.thread),
          });
          if (!checkout.available) {
            throw new Error(checkout.reason ?? "This checkout is unavailable.");
          }

          if (body.inboxItemId) {
            eventData(controller, { type: "setup", stage: "startingTurn" });
          }
          const turn = await codexAppServer.request<{ turn: { id: string } }>(
            "turn/start",
            {
              threadId: activeThreadId,
              input: [{ type: "text", text: prompt, text_elements: [] }],
              cwd: result.thread.cwd,
              approvalPolicy: "on-request",
              sandboxPolicy: { type: "readOnly", networkAccess: false },
            },
          );
          activeTurnId = turn.turn.id;
          eventData(controller, {
            type: "turn",
            threadId: activeThreadId,
            turnId: activeTurnId,
          });
        } catch (error) {
          eventData(controller, {
            type: "error",
            message:
              error instanceof Error ? error.message : "Codex turn failed.",
          });
          finish();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
