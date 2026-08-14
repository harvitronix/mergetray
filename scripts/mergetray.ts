import { type ChildProcess, spawn } from "node:child_process";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import {
  codexCliVersion,
  codexIntegrationEnabled,
} from "../src/lib/codex-integration.ts";
import {
  getDatabase,
  mergetrayDatabasePath,
  setSetting,
  setting,
} from "../src/lib/database.ts";
import {
  ensureGithubAuthScope,
  githubAuthScopes,
  githubAuthStatus,
  githubCliVersion,
  githubWebhookForwardingAvailable,
  installGithubWebhookExtension,
  loginWithGithubCli,
} from "../src/lib/github-auth.ts";
import { GithubApiError, GithubClient } from "../src/lib/github-client.ts";
import {
  addGithubRepository,
  refreshGithubIdentity,
  removeGithubRepositories,
  syncGithub,
} from "../src/lib/github-sync.ts";

const githubWebhooksEnabledSetting = "github_webhooks_enabled";
const githubWebhookTargetSetting = "github_webhook_target";
const githubWebhookEvents = [
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "issue_comment",
  "check_run",
  "check_suite",
  "status",
].join(",");

type SelectedRepository = { full_name: string; owner: string };
type Forwarder = {
  child?: ChildProcess;
  label: string;
  restartTimer?: NodeJS.Timeout;
  stopping: boolean;
};

const webhookRestartDelayMs = 5_000;

function option(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function selectedRepositoryCount() {
  const row = getDatabase()
    .prepare("SELECT COUNT(*) AS count FROM repositories WHERE selected = 1")
    .get() as { count: number | bigint };
  return Number(row.count);
}

function selectedRepositories() {
  return getDatabase()
    .prepare(
      `SELECT full_name, owner FROM repositories
       WHERE selected = 1 AND removed_at IS NULL ORDER BY full_name`,
    )
    .all() as SelectedRepository[];
}

async function doctor() {
  const checks: Array<{ label: string; ok: boolean; detail: string }> = [];
  const [major, minor] = process.versions.node.split(".").map(Number);
  checks.push({
    label: "Node.js",
    ok: major > 24 || (major === 24 && minor >= 15),
    detail: process.version,
  });
  try {
    checks.push({
      label: "GitHub CLI",
      ok: true,
      detail: (await githubCliVersion()) ?? "installed",
    });
  } catch {
    checks.push({
      label: "GitHub CLI",
      ok: false,
      detail: "gh is not installed or not on PATH",
    });
  }
  const authenticated = await githubAuthStatus();
  checks.push({
    label: "GitHub auth",
    ok: authenticated,
    detail: authenticated ? "authenticated" : "run pnpm mergetray setup",
  });
  try {
    getDatabase().prepare("SELECT 1").get();
    checks.push({
      label: "SQLite",
      ok: true,
      detail: mergetrayDatabasePath(),
    });
  } catch (error) {
    checks.push({
      label: "SQLite",
      ok: false,
      detail: error instanceof Error ? error.message : "unavailable",
    });
  }
  const repositories = selectedRepositoryCount();
  checks.push({
    label: "Repositories",
    ok: repositories > 0,
    detail: repositories ? `${repositories} selected` : "none selected",
  });
  const codexEnabled = codexIntegrationEnabled();
  const codexVersion = await codexCliVersion();
  checks.push({
    label: "Codex CLI",
    ok: Boolean(codexVersion) || !codexEnabled,
    detail: codexVersion
      ? `available (${codexVersion}; integration ${codexEnabled ? "enabled" : "disabled"})`
      : codexEnabled
        ? "not found on PATH (integration enabled)"
        : "unavailable (integration disabled)",
  });
  const webhooksEnabled = setting(githubWebhooksEnabledSetting) === "true";
  if (!webhooksEnabled) {
    checks.push({
      label: "Webhook updates",
      ok: true,
      detail: "disabled (run setup to enable)",
    });
  } else {
    const forwardingAvailable = await githubWebhookForwardingAvailable();
    checks.push({
      label: "Webhook extension",
      ok: forwardingAvailable,
      detail: forwardingAvailable ? "installed" : "run pnpm mergetray setup",
    });
    const target = setting(githubWebhookTargetSetting);
    checks.push({
      label: "Webhook target",
      ok: Boolean(target),
      detail: target?.startsWith("org:")
        ? `${target.slice(4)} organization`
        : target === "repositories"
          ? `${repositories} repositories`
          : "run pnpm mergetray setup",
    });
    if (target?.startsWith("org:")) {
      let hasScope = false;
      try {
        hasScope = (await githubAuthScopes()).has("admin:org_hook");
      } catch {
        // GitHub auth already has its own doctor result.
      }
      checks.push({
        label: "Webhook permission",
        ok: hasScope,
        detail: hasScope ? "admin:org_hook" : "run pnpm mergetray setup",
      });
    }
  }

  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify({ ok: checks.every((check) => check.ok), checks }),
    );
  } else {
    for (const check of checks) {
      console.log(`${check.ok ? "✓" : "✗"} ${check.label}: ${check.detail}`);
    }
  }
  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

function repositoryNames(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((repository) => repository.trim())
    .filter(Boolean);
}

async function repositoryChanges() {
  const existing = (
    getDatabase()
      .prepare(
        "SELECT full_name FROM repositories WHERE selected = 1 ORDER BY full_name",
      )
      .all() as Array<{ full_name: string }>
  ).map((row) => row.full_name);
  const configuredAdditions = option("add-repos") ?? option("repos");
  const configuredRemovals = option("remove-repos");
  if (configuredAdditions !== undefined || configuredRemovals !== undefined) {
    return {
      existing,
      additions: repositoryNames(configuredAdditions),
      removals: repositoryNames(configuredRemovals),
    };
  }

  if (existing.length) {
    console.log("Current repositories:");
    for (const repository of existing) console.log(`  - ${repository}`);
  }
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const additions = repositoryNames(
    await prompt.question(
      `Add repositories (comma-separated owner/name${
        existing.length ? "; leave blank to skip" : ""
      }): `,
    ),
  );
  const removals = existing.length
    ? repositoryNames(
        await prompt.question(
          "Remove repositories (comma-separated owner/name; leave blank to keep all): ",
        ),
      )
    : [];
  prompt.close();
  return { existing, additions, removals };
}

async function webhookPreference() {
  const enableFlag = process.argv.includes("--webhooks");
  const disableFlag = process.argv.includes("--no-webhooks");
  if (enableFlag && disableFlag) {
    throw new Error("Choose either --webhooks or --no-webhooks.");
  }
  if (enableFlag || disableFlag) return enableFlag;

  const currentlyEnabled = setting(githubWebhooksEnabledSetting) === "true";
  const repositoriesConfiguredByFlag =
    option("add-repos") !== undefined ||
    option("remove-repos") !== undefined ||
    option("repos") !== undefined;
  if (!process.stdin.isTTY || repositoriesConfiguredByFlag) {
    return currentlyEnabled;
  }
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = (
    await prompt.question(
      `Enable real-time webhook updates? ${currentlyEnabled ? "(Y/n)" : "(y/N)"}: `,
    )
  )
    .trim()
    .toLowerCase();
  prompt.close();
  if (!answer) return currentlyEnabled;
  if (answer === "y" || answer === "yes") return true;
  if (answer === "n" || answer === "no") return false;
  throw new Error("Webhook preference must be yes or no.");
}

async function configureWebhooks(client: GithubClient) {
  if (!(await webhookPreference())) {
    setSetting(githubWebhooksEnabledSetting, "false");
    setSetting(githubWebhookTargetSetting, undefined);
    console.log("✓ Real-time webhook updates disabled");
    return;
  }

  if (!(await githubWebhookForwardingAvailable())) {
    console.log("→ Installing GitHub webhook forwarding");
    await installGithubWebhookExtension();
  }

  const repositories = selectedRepositories();
  const owners = new Set(repositories.map((repository) => repository.owner));
  let webhookTarget = "repositories";
  if (owners.size === 1) {
    const owner = Array.from(owners)[0];
    const account = await client.get<{ type: string }>(`/users/${owner}`);
    if (account.type === "Organization") {
      const scopes = await githubAuthScopes();
      if (!scopes.has("admin:org_hook")) {
        if (process.argv.includes("--no-login")) {
          console.log(
            "• admin:org_hook is unavailable; forwarding repositories individually",
          );
        } else {
          console.log("→ Authorize organization webhook forwarding");
          await ensureGithubAuthScope("admin:org_hook");
        }
      }

      if ((await githubAuthScopes()).has("admin:org_hook")) {
        try {
          const authenticatedClient = await GithubClient.create();
          await authenticatedClient.get<unknown[]>(
            `/orgs/${owner}/hooks?per_page=1`,
          );
          webhookTarget = `org:${owner}`;
        } catch (error) {
          if (!(error instanceof GithubApiError)) throw error;
          console.log(
            `• Organization hooks are unavailable; forwarding ${repositories.length} repositories individually`,
          );
        }
      }
    }
  }

  setSetting(githubWebhooksEnabledSetting, "true");
  setSetting(githubWebhookTargetSetting, webhookTarget);
  console.log(
    `✓ Real-time webhook updates enabled for ${
      webhookTarget.startsWith("org:")
        ? `${webhookTarget.slice(4)} organization`
        : `${repositories.length} repositories`
    }`,
  );
}

async function setup() {
  getDatabase();
  console.log(`✓ SQLite initialized at ${mergetrayDatabasePath()}`);
  if (!(await githubAuthStatus())) {
    if (process.argv.includes("--no-login")) {
      throw new Error("GitHub CLI is not authenticated.");
    }
    console.log("→ Connect GitHub");
    await loginWithGithubCli();
  }

  const client = await GithubClient.create();
  const viewer = await refreshGithubIdentity(client);
  console.log(`✓ Connected to GitHub as @${viewer.login}`);
  const { existing, additions, removals } = await repositoryChanges();
  const selected = new Set([...existing, ...additions]);
  for (const repository of removals) {
    if (!selected.delete(repository)) {
      throw new Error(`Repository is not selected: ${repository}`);
    }
  }
  if (!selected.size && !removals.length) {
    throw new Error("Add at least one repository.");
  }
  const found: string[] = [];
  const notFound: string[] = [];
  for (const repository of additions) {
    try {
      await addGithubRepository(repository, client);
      found.push(repository);
    } catch (error) {
      if (!(error instanceof GithubApiError) || error.status !== 404)
        throw error;
      notFound.push(repository);
    }
  }
  if (additions.length && !found.length) {
    throw new Error("No requested repositories were found.");
  }
  removeGithubRepositories(removals);
  for (const repository of removals) console.log(`✓ Removed ${repository}`);
  await configureWebhooks(client);
  console.log("→ Syncing pull requests");
  const result = await syncGithub(true);
  console.log(
    `✓ Synced ${result.pullRequestCount} pull requests from ${result.repositoryCount} repositories`,
  );
  if (additions.length) {
    console.log("\nRepository lookup:");
    console.log(`  Found: ${found.join(", ") || "none"}`);
    console.log(`  Not found: ${notFound.join(", ") || "none"}`);
  }
  console.log("\nRun pnpm mergetray open, then visit http://localhost:3002.");
}

function appPort() {
  const value = option("port") ?? process.argv[3] ?? "3002";
  const port = Number(value);
  if (!/^\d+$/.test(value) || port < 1 || port > 65_535) {
    throw new Error("Port must be an integer from 1 to 65535.");
  }
  return port;
}

function webhookForwarderSpecs(port: number) {
  if (setting(githubWebhooksEnabledSetting) !== "true") return [];
  const commonArgs = [
    "webhook",
    "forward",
    `--events=${githubWebhookEvents}`,
    `--url=http://127.0.0.1:${port}/api/github/webhook`,
  ];
  const target = setting(githubWebhookTargetSetting);
  if (target?.startsWith("org:")) {
    const organization = target.slice(4);
    return [
      {
        label: `${organization} organization`,
        args: [...commonArgs, `--org=${organization}`],
      },
    ];
  }
  return selectedRepositories().map((repository) => ({
    label: repository.full_name,
    args: [...commonArgs, `--repo=${repository.full_name}`],
  }));
}

function startWebhookForwarders(port: number) {
  return webhookForwarderSpecs(port).map(({ label, args }) => {
    const forwarder: Forwarder = { label, stopping: false };

    function start() {
      const child = spawn("gh", args, { stdio: "inherit" });
      forwarder.child = child;
      child.once("error", (error) => {
        if (!forwarder.stopping) {
          console.warn(
            `Webhook forwarding failed for ${label}: ${error.message}`,
          );
        }
      });
      child.once("close", (code) => {
        if (forwarder.stopping) return;
        console.warn(
          `Webhook forwarding stopped for ${label}${code ? ` (${code})` : ""}; restarting in 5 seconds`,
        );
        forwarder.restartTimer = setTimeout(start, webhookRestartDelayMs);
      });
    }

    start();
    return forwarder;
  });
}

function stopForwarders(forwarders: Forwarder[]) {
  for (const forwarder of forwarders) {
    forwarder.stopping = true;
    if (forwarder.restartTimer) clearTimeout(forwarder.restartTimer);
    if (forwarder.child?.exitCode === null) forwarder.child.kill("SIGTERM");
  }
}

async function openApp() {
  const port = appPort();

  console.log(`→ Launching MergeTray at http://localhost:${port}`);
  const app = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    { stdio: "inherit" },
  );
  const forwarders = startWebhookForwarders(port);
  if (forwarders.length) {
    console.log(
      `→ Starting webhook forwarding for ${forwarders.map(({ label }) => label).join(", ")}`,
    );
  } else {
    console.log("• Real-time webhook updates disabled; polling remains active");
  }

  try {
    await new Promise<void>((resolve, reject) => {
      app.once("error", reject);
      app.once("exit", (code) => {
        if (code === 0 || code === null) resolve();
        else reject(new Error(`MergeTray exited with code ${code}.`));
      });
    });
  } finally {
    stopForwarders(forwarders);
  }
}

async function runWebhooks() {
  const port = appPort();
  const forwarders = startWebhookForwarders(port);
  if (!forwarders.length) {
    throw new Error("Webhook updates are disabled. Run pnpm mergetray setup.");
  }
  console.log(
    `→ Forwarding webhooks to http://127.0.0.1:${port}/api/github/webhook`,
  );
  try {
    await new Promise<void>((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  } finally {
    stopForwarders(forwarders);
  }
}

function help() {
  console.log(`Usage: pnpm mergetray <action> [options]

Actions:
  doctor                     Check Node, gh authentication, SQLite, and setup
  setup                      Configure repositories, webhooks, and sync
  open [--port 3002]         Start MergeTray on localhost
  webhooks [--port 3002]     Run configured webhook forwarding on its own

Options:
  --add-repos a/b,c/d        Add repositories without an interactive prompt
  --remove-repos a/b,c/d     Remove repositories without an interactive prompt
  --webhooks                 Enable webhooks during non-interactive setup
  --no-webhooks              Disable webhooks during setup
  --no-login                 Do not launch gh auth login
  --port 3002                Override the app port
  --json                     Print doctor results as JSON`);
}

const action = process.argv[2];
try {
  if (action === "doctor") await doctor();
  else if (action === "setup") await setup();
  else if (action === "open") await openApp();
  else if (action === "webhooks") await runWebhooks();
  else {
    help();
    if (action) process.exitCode = 1;
  }
} catch (error) {
  console.error(
    `✗ ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exitCode = 1;
}
