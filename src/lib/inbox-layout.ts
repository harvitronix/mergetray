export type InboxLayout = "grouped" | "visual";

export const inboxLayoutCookieName = "jabni-inbox-layout";

export function inboxLayout(value: string | undefined): InboxLayout {
  return value === "visual" ? "visual" : "grouped";
}
