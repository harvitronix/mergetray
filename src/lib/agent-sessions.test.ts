import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  attachAgentSessionLinks,
  listAgentSessionLinks,
  setAgentSessionLink,
  unlinkAgentSession,
} from "./agent-sessions.ts";
import {
  codexIntegrationEnabled,
  codexIntegrationSetting,
} from "./codex-integration.ts";
import { closeDatabase, getDatabase, setSetting } from "./database.ts";
import type { InboxRow } from "./models.ts";

let dataDirectory: string;

beforeEach(() => {
  dataDirectory = mkdtempSync(join(tmpdir(), "mergetray-agent-sessions-"));
  process.env.MERGETRAY_DATA_DIR = dataDirectory;
  getDatabase().exec(`
    INSERT INTO repositories(
      id, github_repo_id, owner, name, full_name, private, archived, selected
    ) VALUES (1, 1, 'acme', 'widgets', 'acme/widgets', 0, 0, 1);
    INSERT INTO inbox_items(
      id, repository_id, number, title, url, author_login, state, updated_at, last_synced_at
    ) VALUES (1, 1, 1, 'Test PR', 'https://example.com/1', 'author', 'open', 1, 1);
  `);
});

afterEach(() => {
  closeDatabase();
  delete process.env.MERGETRAY_DATA_DIR;
  rmSync(dataDirectory, { recursive: true });
});

describe("agent session links", () => {
  test("Codex integration is disabled until explicitly enabled", () => {
    expect(codexIntegrationEnabled()).toBe(false);

    setSetting(codexIntegrationSetting, "true");

    expect(codexIntegrationEnabled()).toBe(true);
  });

  test("attaches stored links without loading Codex tasks", () => {
    setAgentSessionLink("1", "codex", "session-1");
    const row = {
      item: { id: "1" },
      agentSessionLinks: [],
      agentSessionCandidates: [],
    } as unknown as InboxRow;

    expect(attachAgentSessionLinks([row])[0].agentSessionLinks).toEqual([
      { provider: "codex", sessionId: "session-1" },
    ]);
  });

  test("explicit unlinking suppresses auto-linking until a manual link", () => {
    setAgentSessionLink("1", "codex", "session-1");
    unlinkAgentSession("1", "codex");

    expect(listAgentSessionLinks()).toEqual([]);
    expect(
      getDatabase()
        .prepare("SELECT provider FROM agent_session_auto_link_suppressions")
        .all(),
    ).toEqual([{ provider: "codex" }]);

    setAgentSessionLink("1", "codex", "session-2");

    expect(listAgentSessionLinks()).toEqual([
      { inboxItemId: "1", provider: "codex", sessionId: "session-2" },
    ]);
    expect(
      getDatabase()
        .prepare("SELECT * FROM agent_session_auto_link_suppressions")
        .all(),
    ).toEqual([]);
  });
});
