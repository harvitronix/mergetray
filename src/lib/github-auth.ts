import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runGithubCli(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("gh", args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`GitHub CLI exited with code ${code}.`));
    });
  });
}

export async function githubCliVersion() {
  const { stdout } = await execFileAsync("gh", ["--version"]);
  return stdout.split("\n")[0]?.trim();
}

export async function githubToken() {
  const { stdout } = await execFileAsync("gh", [
    "auth",
    "token",
    "--hostname",
    "github.com",
  ]);
  const token = stdout.trim();
  if (!token) throw new Error("GitHub CLI returned an empty token.");
  return token;
}

export async function githubAuthStatus() {
  try {
    await execFileAsync("gh", [
      "auth",
      "status",
      "--hostname",
      "github.com",
      "--active",
    ]);
    await githubToken();
    return true;
  } catch {
    return false;
  }
}

export async function githubAuthScopes() {
  const { stdout } = await execFileAsync("gh", [
    "auth",
    "status",
    "--active",
    "--hostname",
    "github.com",
    "--json",
    "hosts",
  ]);
  const result = JSON.parse(stdout) as {
    hosts: Record<string, Array<{ active: boolean; scopes: string }>>;
  };
  const account = result.hosts["github.com"]?.find((entry) => entry.active);
  return new Set(
    (account?.scopes ?? "")
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
}

export async function ensureGithubAuthScope(scope: string) {
  if ((await githubAuthScopes()).has(scope)) return false;
  await runGithubCli([
    "auth",
    "refresh",
    "--hostname",
    "github.com",
    "--scopes",
    scope,
  ]);
  return true;
}

export async function githubWebhookForwardingAvailable() {
  try {
    await execFileAsync("gh", ["webhook", "forward", "--help"]);
    return true;
  } catch {
    return false;
  }
}

export async function installGithubWebhookExtension() {
  await runGithubCli(["extension", "install", "cli/gh-webhook"]);
}

export async function loginWithGithubCli() {
  await runGithubCli([
    "auth",
    "login",
    "--hostname",
    "github.com",
    "--web",
    "--skip-ssh-key",
  ]);
}
