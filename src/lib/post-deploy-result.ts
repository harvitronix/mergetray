export type CapabilityAuditResult = {
  overall: "ready" | "partial" | "blocked";
  summary: string;
  checks: Array<{
    capability:
      | "deployment_correlation"
      | "production_browser"
      | "sentry"
      | "posthog"
      | "vercel";
    status: "available" | "unavailable" | "not_configured" | "error";
    evidence: string;
  }>;
  nextStep: string;
};

export type PostDeployMonitorLink = {
  status: "queued" | "running" | "completed" | "interrupted" | "failed";
  threadId?: string;
};

const overalls = new Set(["ready", "partial", "blocked"]);
const capabilities = new Set([
  "deployment_correlation",
  "production_browser",
  "sentry",
  "posthog",
  "vercel",
]);
const statuses = new Set([
  "available",
  "unavailable",
  "not_configured",
  "error",
]);

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseCapabilityAuditResult(text: string) {
  try {
    const result: unknown = JSON.parse(text);
    if (
      !record(result) ||
      !overalls.has(String(result.overall)) ||
      typeof result.summary !== "string" ||
      typeof result.nextStep !== "string" ||
      !Array.isArray(result.checks) ||
      !result.checks.every(
        (check) =>
          record(check) &&
          capabilities.has(String(check.capability)) &&
          statuses.has(String(check.status)) &&
          typeof check.evidence === "string",
      )
    ) {
      return undefined;
    }
    return result as CapabilityAuditResult;
  } catch {
    return undefined;
  }
}

export const capabilityAuditResultSchema = {
  type: "object",
  properties: {
    overall: { type: "string", enum: ["ready", "partial", "blocked"] },
    summary: { type: "string" },
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          capability: {
            type: "string",
            enum: [
              "deployment_correlation",
              "production_browser",
              "sentry",
              "posthog",
              "vercel",
            ],
          },
          status: {
            type: "string",
            enum: ["available", "unavailable", "not_configured", "error"],
          },
          evidence: { type: "string" },
        },
        required: ["capability", "status", "evidence"],
        additionalProperties: false,
      },
    },
    nextStep: { type: "string" },
  },
  required: ["overall", "summary", "checks", "nextStep"],
  additionalProperties: false,
};
