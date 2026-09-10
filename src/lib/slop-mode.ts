import { setting } from "./database.ts";

export const slopModeSetting = "slop_mode_enabled";

export function slopModeEnabled() {
  return setting(slopModeSetting) === "true";
}
