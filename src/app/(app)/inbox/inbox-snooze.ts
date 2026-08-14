export const snoozeOptions = [
  { value: "1h", label: "1 hour" },
  { value: "3h", label: "3 hours" },
  { value: "tomorrow", label: "Tomorrow 8am" },
  { value: "nextWeek", label: "Monday 8am" },
] as const;

export type SnoozeDuration = (typeof snoozeOptions)[number]["value"];

export function localSnoozeTime(duration: SnoozeDuration) {
  if (duration !== "tomorrow" && duration !== "nextWeek") return;

  const next = new Date();
  if (duration === "tomorrow") {
    next.setHours(8, 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  } else {
    next.setDate(next.getDate() + ((8 - next.getDay()) % 7 || 7));
    next.setHours(8, 0, 0, 0);
  }
  return next.getTime();
}
