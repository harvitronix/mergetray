import { describe, expect, it } from "vitest";
import {
  defaultKanbanMergedHours,
  kanbanMergedHours,
} from "./inbox-preferences.ts";

describe("kanbanMergedHours", () => {
  it("uses 24 hours unless a positive whole number is saved", () => {
    expect(kanbanMergedHours("")).toBe(defaultKanbanMergedHours);
    expect(kanbanMergedHours("0")).toBe(defaultKanbanMergedHours);
    expect(kanbanMergedHours("1.5")).toBe(defaultKanbanMergedHours);
    expect(kanbanMergedHours("48")).toBe(48);
  });
});
