import { setting } from "./database.ts";

export const ignoreCheckUpdatesSetting = "ignore_check_updates";

export function ignoreCheckUpdates() {
  return setting(ignoreCheckUpdatesSetting) === "true";
}
