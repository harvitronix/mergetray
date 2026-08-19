import { expect, test } from "vitest";
import { githubCliForwardingHookIds } from "./github-webhook-forwarding.ts";

test("selects only GitHub CLI forwarding hooks", () => {
  expect(
    githubCliForwardingHookIds([
      {
        id: 1,
        name: "cli",
        config: { url: "https://webhook-forwarder.github.com/hook" },
      },
      { id: 2, name: "web", config: { url: "https://example.com/hook" } },
      { id: 3, name: "cli", config: { url: "https://example.com/hook" } },
    ]),
  ).toEqual([1]);
});
