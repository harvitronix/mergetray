import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const schema = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY,
    github_repo_id INTEGER NOT NULL UNIQUE,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL UNIQUE,
    private INTEGER NOT NULL,
    archived INTEGER NOT NULL,
    selected INTEGER NOT NULL DEFAULT 1,
    removed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS inbox_items (
    id INTEGER PRIMARY KEY,
    repository_id INTEGER NOT NULL REFERENCES repositories(id),
    github_item_id INTEGER,
    github_node_id TEXT,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    author_github_user_id TEXT,
    author_login TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('open', 'closed', 'merged')),
    updated_at INTEGER NOT NULL,
    closed_at INTEGER,
    last_synced_at INTEGER NOT NULL,
    UNIQUE(repository_id, number)
  );
  CREATE INDEX IF NOT EXISTS inbox_items_state ON inbox_items(state);
  CREATE INDEX IF NOT EXISTS inbox_items_repo_state ON inbox_items(repository_id, state);
  CREATE TABLE IF NOT EXISTS pull_request_details (
    id INTEGER PRIMARY KEY,
    inbox_item_id INTEGER NOT NULL UNIQUE REFERENCES inbox_items(id) ON DELETE CASCADE,
    draft INTEGER NOT NULL,
    additions INTEGER,
    deletions INTEGER,
    changed_files INTEGER,
    head_sha TEXT NOT NULL,
    head_ref TEXT NOT NULL,
    base_ref TEXT NOT NULL,
    merged_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS pull_request_statuses (
    id INTEGER PRIMARY KEY,
    inbox_item_id INTEGER NOT NULL UNIQUE REFERENCES inbox_items(id) ON DELETE CASCADE,
    head_sha TEXT NOT NULL,
    rollup_state TEXT NOT NULL,
    failing_count INTEGER NOT NULL,
    pending_count INTEGER NOT NULL,
    passing_count INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inbox_item_participants (
    id INTEGER PRIMARY KEY,
    inbox_item_id INTEGER NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    github_user_id TEXT,
    github_login TEXT NOT NULL,
    github_org_login TEXT,
    github_team_slug TEXT,
    relationship TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS participants_item ON inbox_item_participants(inbox_item_id);
  CREATE TABLE IF NOT EXISTS inbox_item_timeline (
    id INTEGER PRIMARY KEY,
    inbox_item_id INTEGER NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    actor_login TEXT,
    actor_github_user_id TEXT,
    sort_order INTEGER,
    count INTEGER
  );
  CREATE INDEX IF NOT EXISTS timeline_item ON inbox_item_timeline(inbox_item_id);
  CREATE TABLE IF NOT EXISTS user_inbox_item_states (
    id INTEGER PRIMARY KEY,
    inbox_item_id INTEGER NOT NULL UNIQUE REFERENCES inbox_items(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('active', 'done')),
    marked_done_at INTEGER,
    snoozed_until INTEGER,
    ship_it_promoted_at INTEGER,
    note TEXT
  );
  CREATE TABLE IF NOT EXISTS agent_session_links (
    inbox_item_id INTEGER NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    session_id TEXT NOT NULL,
    PRIMARY KEY(inbox_item_id, provider)
  );
  CREATE TABLE IF NOT EXISTS agent_session_dismissals (
    inbox_item_id INTEGER NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    session_id TEXT NOT NULL,
    PRIMARY KEY(inbox_item_id, provider, session_id)
  );
  CREATE TABLE IF NOT EXISTS agent_session_auto_link_suppressions (
    inbox_item_id INTEGER NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    PRIMARY KEY(inbox_item_id, provider)
  );
  CREATE TABLE IF NOT EXISTS github_http_cache (
    cache_key TEXT PRIMARY KEY,
    etag TEXT,
    body TEXT NOT NULL,
    has_next INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sync_state (
    source TEXT PRIMARY KEY,
    last_started_at INTEGER,
    last_completed_at INTEGER,
    failed_at INTEGER,
    error TEXT
  );
`;

let database: DatabaseSync | undefined;
let databasePath: string | undefined;

function mergetrayDataDirectory() {
  const configured = process.env.MERGETRAY_DATA_DIR?.trim();
  return configured
    ? path.resolve(/* turbopackIgnore: true */ configured)
    : path.join(process.cwd(), ".mergetray");
}

export function mergetrayDatabasePath() {
  return path.join(mergetrayDataDirectory(), "mergetray.sqlite");
}

export function getDatabase() {
  const nextPath = mergetrayDatabasePath();
  if (database && databasePath === nextPath) return database;
  database?.close();
  fs.mkdirSync(path.dirname(nextPath), { recursive: true });
  database = new DatabaseSync(nextPath, { timeout: 5_000 });
  databasePath = nextPath;
  database.exec(schema);
  return database;
}

export function closeDatabase() {
  database?.close();
  database = undefined;
  databasePath = undefined;
}

export function setting(key: string) {
  const row = getDatabase()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string | undefined) {
  const db = getDatabase();
  if (value === undefined) {
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
    return;
  }
  db.prepare(
    "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function integer(value: number | bigint) {
  return Number(value);
}

export function id(value: number | bigint) {
  return String(value);
}
