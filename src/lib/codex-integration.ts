import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setting } from "./database.ts";

const execFileAsync = promisify(execFile);

export const codexIntegrationSetting = "codex_integration_enabled";

export function codexIntegrationEnabled() {
  return setting(codexIntegrationSetting) === "true";
}

export async function codexCliVersion() {
  try {
    const { stdout } = await execFileAsync("codex", ["--version"], {
      timeout: 2_000,
    });
    return stdout.trim();
  } catch {
    return undefined;
  }
}
