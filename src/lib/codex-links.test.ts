import { describe, expect, test } from "vitest";
import {
  codexSessionId,
  codexSessionMatches,
  codexSessionUrl,
  githubRepository,
  newCodexTaskUrl,
  singleActiveCodexSession,
} from "./codex-links.ts";

const sessionId = "019fdd88-acde-78f3-b0a8-9f1a27c94dec";

describe("Codex links", () => {
  test("accepts a task ID or exact Codex task link", () => {
    expect(codexSessionId(sessionId)).toBe(sessionId);
    expect(codexSessionId(`codex://threads/${sessionId}`)).toBe(sessionId);
    expect(codexSessionId("codex://threads/new")).toBeUndefined();
  });

  test("opens an existing task inside MergeTray", () => {
    expect(codexSessionUrl(sessionId)).toBe(`/codex?thread=${sessionId}`);
  });

  test("opens a PR task draft inside MergeTray", () => {
    expect(newCodexTaskUrl("123")).toBe("/codex?newFor=123");
  });

  test("matches candidates by exact GitHub repository and branch", () => {
    const session = {
      provider: "codex" as const,
      sessionId,
      title: "Finish the thing",
      cwd: "/worktree",
      updatedAt: 1,
      archived: false,
      branch: "feature/finish-the-thing",
      githubRepoId: 123,
    };

    expect(codexSessionMatches(session, 123, "feature/finish-the-thing")).toBe(
      true,
    );
    expect(codexSessionMatches(session, 456, session.branch)).toBe(false);
  });

  test("extracts GitHub repositories from SSH and HTTPS remotes", () => {
    expect(githubRepository("git@github.com:acme/widgets.git")).toBe(
      "acme/widgets",
    );
    expect(githubRepository("https://github.com/acme/widgets")).toBe(
      "acme/widgets",
    );
  });

  test("selects one active task without guessing between several", () => {
    const session = {
      provider: "codex" as const,
      sessionId,
      title: "Finish the thing",
      cwd: "/worktree",
      updatedAt: 1,
      archived: false,
    };

    expect(singleActiveCodexSession([session])).toBe(session);
    expect(
      singleActiveCodexSession([
        session,
        {
          ...session,
          sessionId: "019fdd89-acde-78f3-b0a8-9f1a27c94dec",
          archived: true,
        },
      ]),
    ).toBe(session);
    expect(
      singleActiveCodexSession([
        session,
        { ...session, sessionId: "019fdd89-acde-78f3-b0a8-9f1a27c94dec" },
      ]),
    ).toBeUndefined();
    expect(
      singleActiveCodexSession([{ ...session, archived: true }]),
    ).toBeUndefined();
  });
});
