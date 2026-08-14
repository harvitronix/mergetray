import { describe, expect, test } from "vitest";
import {
  codexSessionId,
  codexSessionMatches,
  githubRepository,
  newCodexSessionUrl,
  singleActiveCodexSession,
} from "./codex-links.ts";

const sessionId = "019fdd88-acde-78f3-b0a8-9f1a27c94dec";

describe("Codex links", () => {
  test("accepts a task ID or exact Codex task link", () => {
    expect(codexSessionId(sessionId)).toBe(sessionId);
    expect(codexSessionId(`codex://threads/${sessionId}`)).toBe(sessionId);
    expect(codexSessionId("codex://threads/new")).toBeUndefined();
  });

  test("builds a new task link with repository and PR context", () => {
    const link = new URL(
      newCodexSessionUrl({
        repository: "acme/widgets",
        number: 123,
        title: "Finish the thing",
        url: "https://github.com/acme/widgets/pull/123",
        branch: "feature/finish-the-thing",
      }),
    );

    expect(link.hostname).toBe("threads");
    expect(link.pathname).toBe("/new");
    expect(link.searchParams.get("originUrl")).toBe(
      "git@github.com:acme/widgets.git",
    );
    expect(link.searchParams.get("prompt")).toContain(
      "Branch: feature/finish-the-thing",
    );
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
