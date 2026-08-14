import { expect, it } from "vitest";
import { isLocalRequest } from "./local-request.ts";

it.each([
  ["127.0.0.1:3002", undefined, true],
  ["localhost:3002", "http://localhost:3002", true],
  ["localhost:3002", "http://127.0.0.1:3002", false],
  ["localhost:3002", "https://example.com", false],
  ["example.com:3002", "http://example.com:3002", false],
])("checks that %s is local", (host, origin, expected) => {
  const request = new Request("http://localhost:3002/api/sync", {
    headers: { host, ...(origin ? { origin } : {}) },
  });
  expect(isLocalRequest(request)).toBe(expected);
});
