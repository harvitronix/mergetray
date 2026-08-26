import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";

type RpcMessage = {
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message?: string };
};

export type CodexThreadItem =
  | {
      type: "userMessage";
      id: string;
      content: Array<{ type: string; text?: string }>;
    }
  | {
      type: "agentMessage";
      id: string;
      text: string;
      phase?: "commentary" | "final_answer" | null;
    }
  | { type: "reasoning"; id: string; summary: string[]; content: string[] }
  | {
      type: "commandExecution";
      id: string;
      command: string;
      aggregatedOutput: string | null;
      status: string;
    }
  | {
      type: "fileChange";
      id: string;
      changes: Array<{ path: string }>;
      status: string;
    };

export type CodexThread = {
  id: string;
  name: string | null;
  preview: string;
  cwd: string;
  gitInfo: {
    sha: string | null;
    branch: string | null;
    originUrl: string | null;
  } | null;
  turns: Array<{ items: CodexThreadItem[] }>;
};

export type CodexChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "message" | "reasoning";
  phase?: "commentary" | "final_answer" | null;
};

class CodexAppServer {
  private child?: ChildProcessWithoutNullStreams;
  private connecting?: Promise<void>;
  private nextId = 1;
  private pending = new Map<
    string | number,
    { resolve: (result: unknown) => void; reject: (error: Error) => void }
  >();
  private listeners = new Set<(message: RpcMessage) => void>();

  async request<T>(method: string, params: Record<string, unknown>) {
    await this.connect();
    return this.rawRequest<T>(method, params);
  }

  async respond(id: string | number, result: unknown) {
    await this.connect();
    this.write({ id, result });
  }

  subscribe(listener: (message: RpcMessage) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private connect() {
    this.connecting ??= this.start().catch((error) => {
      this.connecting = undefined;
      throw error;
    });
    return this.connecting;
  }

  private async start() {
    const child = spawn("codex", ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    child.stderr.resume();
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => this.receive(line));
    child.on("error", (error) => this.fail(error));
    child.on("exit", () => this.fail(new Error("Codex App Server stopped.")));

    await this.rawRequest("initialize", {
      clientInfo: {
        name: "mergetray",
        title: "MergeTray",
        version: "0.1.0",
      },
      capabilities: null,
    });
    this.write({ method: "initialized" });
  }

  private rawRequest<T>(method: string, params: Record<string, unknown>) {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, 10_000);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.write({ id, method, params });
    });
  }

  private write(message: RpcMessage) {
    if (!this.child) throw new Error("Codex App Server is unavailable.");
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private receive(line: string) {
    let message: RpcMessage;
    try {
      message = JSON.parse(line) as RpcMessage;
    } catch {
      return;
    }

    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(
          new Error(message.error.message ?? "Codex request failed."),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    for (const listener of this.listeners) listener(message);
  }

  private fail(error: Error) {
    this.child = undefined;
    this.connecting = undefined;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

const codexGlobal = globalThis as typeof globalThis & {
  mergetrayCodexAppServer?: CodexAppServer;
};

if (!codexGlobal.mergetrayCodexAppServer) {
  codexGlobal.mergetrayCodexAppServer = new CodexAppServer();
}
export const codexAppServer = codexGlobal.mergetrayCodexAppServer;

export function codexThreadMessages(thread: Pick<CodexThread, "turns">) {
  return thread.turns.flatMap((turn) =>
    turn.items.flatMap((item): CodexChatMessage[] => {
      if (item.type === "userMessage") {
        const content = item.content
          .filter((part) => part.type === "text")
          .map((part) => part.text ?? "")
          .join("\n");
        return content ? [{ id: item.id, role: "user", content }] : [];
      }
      if (item.type === "agentMessage") {
        return [
          {
            id: item.id,
            role: "assistant",
            content: item.text,
            kind: "message",
            phase: item.phase,
          },
        ];
      }
      if (item.type === "reasoning") {
        const content = item.summary.join("\n\n");
        return content
          ? [{ id: item.id, role: "assistant", content, kind: "reasoning" }]
          : [];
      }
      return [];
    }),
  );
}
