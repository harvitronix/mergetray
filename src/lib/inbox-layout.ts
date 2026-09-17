export type InboxLayout = "grouped" | "visual" | "kanban";

export const inboxLayoutCookieName = "jabni-inbox-layout";

export function inboxLayout(value: string | undefined): InboxLayout {
  return value === "visual" || value === "kanban" ? value : "grouped";
}
