import { describe, expect, test } from "vitest";
import { type CodexThread, codexThreadMessages } from "./codex-app-server.ts";

describe("codexThreadMessages", () => {
  test("keeps user and agent text while ignoring tool items", () => {
    const thread = {
      turns: [
        {
          items: [
            {
              type: "userMessage",
              id: "user-1",
              content: [{ type: "text", text: "Inspect this branch" }],
            },
            {
              type: "commandExecution",
              id: "command-1",
              command: "git status",
              aggregatedOutput: "clean",
              status: "completed",
            },
            {
              type: "reasoning",
              id: "reasoning-1",
              summary: ["Checking the working tree"],
              content: ["Unrendered raw reasoning"],
            },
            {
              type: "agentMessage",
              id: "agent-1",
              text: "The branch is clean.",
              phase: "final_answer",
            },
          ],
        },
      ],
    } satisfies Pick<CodexThread, "turns">;

    expect(codexThreadMessages(thread)).toEqual([
      { id: "user-1", role: "user", content: "Inspect this branch" },
      {
        id: "reasoning-1",
        role: "assistant",
        content: "Checking the working tree",
        kind: "reasoning",
      },
      {
        id: "agent-1",
        role: "assistant",
        content: "The branch is clean.",
        kind: "message",
        phase: "final_answer",
      },
    ]);
  });
});
