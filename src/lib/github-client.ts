import { githubToken } from "./github-auth.ts";

type RestResult<T> = {
  data?: T;
  etag?: string;
  hasNext: boolean;
  notModified: boolean;
};

export class GithubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(`GitHub API ${status}: ${message}`);
    this.status = status;
  }
}

function nextLink(value: string | null) {
  return value?.split(",").some((part) => /rel="next"/.test(part)) ?? false;
}

export class GithubClient {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  static async create() {
    return new GithubClient(await githubToken());
  }

  async get<T>(path: string) {
    const response = await this.rest<T>(path);
    if (!response.data) throw new Error(`GitHub returned no data for ${path}.`);
    return response.data;
  }

  async rest<T>(path: string, etag?: string): Promise<RestResult<T>> {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "x-github-api-version": "2022-11-28",
        ...(etag ? { "if-none-match": etag } : {}),
      },
    });
    if (response.status === 304) {
      return { etag, hasNext: false, notModified: true };
    }
    if (!response.ok) {
      const message = await response.text();
      throw new GithubApiError(response.status, message.slice(0, 240));
    }
    return {
      data: (await response.json()) as T,
      etag: response.headers.get("etag") ?? undefined,
      hasNext: nextLink(response.headers.get("link")),
      notModified: false,
    };
  }

  async graphql<T>(query: string, variables: Record<string, unknown> = {}) {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const result = (await response.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };
    if (!response.ok || result.errors?.length || !result.data) {
      throw new Error(
        result.errors?.[0]?.message ??
          `GitHub GraphQL failed (${response.status}).`,
      );
    }
    return result.data;
  }
}
