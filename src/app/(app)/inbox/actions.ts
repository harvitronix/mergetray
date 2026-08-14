"use server";

import { revalidatePath } from "next/cache";
import {
  dismissAgentSession,
  setAgentSessionLink,
  unlinkAgentSession,
} from "@/lib/agent-sessions";
import { codexIntegrationEnabled } from "@/lib/codex-integration";
import { codexSessionId } from "@/lib/codex-links";

function inboxItemId(formData: FormData) {
  const value = String(formData.get("inboxItemId") ?? "");
  return /^\d+$/.test(value) ? value : undefined;
}

export async function linkCodexSession(formData: FormData) {
  if (!codexIntegrationEnabled()) return;
  const itemId = inboxItemId(formData);
  const sessionId = codexSessionId(String(formData.get("session") ?? ""));
  if (!itemId || !sessionId) return;

  setAgentSessionLink(itemId, "codex", sessionId);
  revalidatePath("/", "layout");
  return sessionId;
}

export async function unlinkCodexSession(formData: FormData) {
  if (!codexIntegrationEnabled()) return;
  const itemId = inboxItemId(formData);
  if (!itemId) return;

  unlinkAgentSession(itemId, "codex");
  revalidatePath("/", "layout");
  return true;
}

export async function dismissCodexSession(formData: FormData) {
  if (!codexIntegrationEnabled()) return;
  const itemId = inboxItemId(formData);
  const sessionId = codexSessionId(String(formData.get("session") ?? ""));
  if (!itemId || !sessionId) return;

  dismissAgentSession(itemId, "codex", sessionId);
  revalidatePath("/", "layout");
  return sessionId;
}
