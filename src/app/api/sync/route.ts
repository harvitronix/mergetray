import { githubDataRevision, syncGithub } from "@/lib/github-sync";
import { isLocalRequest } from "@/lib/local-request";

export async function POST(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });

  let failed = false;
  const force = new URL(request.url).searchParams.get("force") === "1";
  await syncGithub(force).catch(() => {
    failed = true;
  });
  return Response.json({ revision: githubDataRevision(), failed });
}
