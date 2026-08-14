import type { AgentSession } from "./models";

const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function codexSessionId(value: string) {
  const trimmed = value.trim();
  if (sessionIdPattern.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const sessionId = url.pathname.slice(1);
    return url.protocol === "codex:" &&
      url.hostname === "threads" &&
      sessionIdPattern.test(sessionId)
      ? sessionId
      : undefined;
  } catch {
    return undefined;
  }
}

export function codexSessionUrl(sessionId: string) {
  return `codex://threads/${sessionId}`;
}

export function newCodexSessionUrl(pullRequest: {
  repository: string;
  number: number;
  title: string;
  url: string;
  branch: string;
}) {
  const params = new URLSearchParams({
    originUrl: `git@github.com:${pullRequest.repository}.git`,
    prompt: `Continue wrapping up ${pullRequest.repository}#${pullRequest.number}: ${pullRequest.title}\nPR: ${pullRequest.url}\nBranch: ${pullRequest.branch}`,
  });
  return `codex://threads/new?${params}`;
}

export function githubRepository(originUrl: string) {
  return originUrl
    .match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/i)?.[1]
    ?.toLowerCase();
}

export function codexSessionMatches(
  session: AgentSession & { branch: string; githubRepoId?: number },
  githubRepoId: number,
  branch: string,
) {
  return (
    session.provider === "codex" &&
    session.branch === branch &&
    session.githubRepoId === githubRepoId
  );
}

export function singleActiveCodexSession(sessions: AgentSession[]) {
  const active = sessions.filter((session) => !session.archived);
  return active.length === 1 ? active[0] : undefined;
}
