import { describe, expect, test } from "vitest";
import { reviewableDiff } from "./diff-file-filters.ts";

describe("reviewableDiff", () => {
  test("excludes matching paths and basename globs", () => {
    expect(
      reviewableDiff(
        [
          { filename: "src/app.ts", additions: 12, deletions: 2 },
          { filename: "src/app.test.ts", additions: 20, deletions: 0 },
          { filename: "generated/schema.ts", additions: 100, deletions: 50 },
        ],
        ["*.test.ts", "generated/**"],
      ),
    ).toEqual({
      additions: 12,
      deletions: 2,
      changedFiles: 1,
      excludedFiles: 2,
    });
  });
});
