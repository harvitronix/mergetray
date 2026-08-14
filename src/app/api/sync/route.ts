import { syncGithub } from "@/lib/github-sync";
import { isLocalRequest } from "@/lib/local-request";

export async function POST(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });

  await syncGithub().catch(() => undefined);
  return new Response(null, { status: 204 });
}
