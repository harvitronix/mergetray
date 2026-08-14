import { after } from "next/server";
import {
  githubWebhookTargets,
  queueGithubWebhookSync,
} from "@/lib/github-webhooks";
import { isLocalRequest } from "@/lib/local-request";

export async function POST(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });

  const event = request.headers.get("x-github-event");
  if (!event) return new Response("Missing GitHub event", { status: 400 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const targets = githubWebhookTargets(event, payload);
  if (!targets.length) return new Response(null, { status: 204 });

  after(() => queueGithubWebhookSync(targets));
  return new Response(null, { status: 202 });
}
