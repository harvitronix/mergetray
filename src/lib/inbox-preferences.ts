import { setting } from "./database.ts";

export const ignoreCheckUpdatesSetting = "ignore_check_updates";
export const kanbanMergedHoursSetting = "kanban_merged_hours";
export const defaultKanbanMergedHours = 24;

export function ignoreCheckUpdates() {
  return setting(ignoreCheckUpdatesSetting) === "true";
}

export function kanbanMergedHours(value = setting(kanbanMergedHoursSetting)) {
  const hours = Number(value);
  return Number.isSafeInteger(hours) && hours > 0
    ? hours
    : defaultKanbanMergedHours;
}
