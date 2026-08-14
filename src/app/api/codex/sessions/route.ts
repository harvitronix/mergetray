import { codexSessionsForInboxItem } from "@/lib/agent-sessions";
import { isLocalRequest } from "@/lib/local-request";

export async function POST(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });

  const body = (await request.json().catch(() => undefined)) as
    | { inboxItemId?: string }
    | undefined;
  if (!body?.inboxItemId || !/^\d+$/.test(body.inboxItemId)) {
    return Response.json({ error: "Invalid inbox item." }, { status: 400 });
  }

  const result = await codexSessionsForInboxItem(body.inboxItemId);
  return result
    ? Response.json(result)
    : Response.json(
        { error: "Codex integration is unavailable." },
        { status: 404 },
      );
}
