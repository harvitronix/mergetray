export type AppTheme = "system" | "light" | "dark";

export const themeCookieName = "jabni-theme";

export function appTheme(value: string | undefined): AppTheme {
  if (value === "light" || value === "dark") return value;
  return "system";
}
