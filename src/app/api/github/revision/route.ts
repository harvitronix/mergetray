import { githubDataRevision } from "@/lib/github-sync";

export function GET() {
  return Response.json(
    { revision: githubDataRevision() },
    { headers: { "cache-control": "no-store" } },
  );
}
