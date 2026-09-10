import path from "node:path";
import { setting } from "./database.ts";

export const diffFileFiltersSetting = "diff_file_filters";

export type PullRequestFile = {
  filename: string;
  additions: number;
  deletions: number;
};

export function diffFileFilters(value = setting(diffFileFiltersSetting)) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((pattern) => pattern.trim())
    .filter(Boolean);
}

function matches(filename: string, pattern: string) {
  return path.matchesGlob(
    pattern.includes("/") ? filename : path.posix.basename(filename),
    pattern,
  );
}

export function reviewableDiff(files: PullRequestFile[], patterns: string[]) {
  if (!patterns.length) return undefined;
  const included = files.filter(
    (file) => !patterns.some((pattern) => matches(file.filename, pattern)),
  );
  return {
    additions: included.reduce((sum, file) => sum + file.additions, 0),
    deletions: included.reduce((sum, file) => sum + file.deletions, 0),
    changedFiles: included.length,
    excludedFiles: files.length - included.length,
  };
}
