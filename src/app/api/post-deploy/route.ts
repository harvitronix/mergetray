import { after } from "next/server";
import { codexIntegrationEnabled } from "@/lib/codex-integration";
import { syncGithubItem } from "@/lib/github-sync";
import { isLocalRequest } from "@/lib/local-request";
import {
  executePostDeployCapabilityRun,
  postDeployRunById,
  postDeployTarget,
  queuePostDeployCapabilityRun,
} from "@/lib/post-deploy-monitor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  const runId = new URL(request.url).searchParams.get("runId");
  const run = runId ? postDeployRunById(runId) : undefined;
  return run
    ? Response.json(run)
    : Response.json({ error: "Post-deploy run not found." }, { status: 404 });
}

export async function POST(request: Request) {
  if (!isLocalRequest(request) || !codexIntegrationEnabled()) {
    return new Response(null, { status: 403 });
  }
  const body = (await request.json().catch(() => undefined)) as
    | { inboxItemId?: string }
    | undefined;
  if (!body?.inboxItemId || !/^\d+$/.test(body.inboxItemId)) {
    return Response.json({ error: "Invalid pull request." }, { status: 400 });
  }

  try {
    const target = postDeployTarget(body.inboxItemId);
    if (!target) throw new Error("Choose a merged pull request.");
    await syncGithubItem(target);
    const run = queuePostDeployCapabilityRun(body.inboxItemId);
    after(() => executePostDeployCapabilityRun(run.id));
    return Response.json(run, { status: 202 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Post-deploy audit could not start.",
      },
      { status: 400 },
    );
  }
}
