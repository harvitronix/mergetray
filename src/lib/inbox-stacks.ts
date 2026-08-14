import {
  classifyInboxSection,
  inboxSectionDefinitions,
} from "@/lib/inbox-section-rules";
import type { InboxRow } from "@/lib/models";

const sectionRank = new Map(
  inboxSectionDefinitions.map((section, index) => [section.id, index]),
);

export function groupInboxRows(rows: InboxRow[], now: number) {
  const rowByHead = new Map(
    rows.map(
      (row) =>
        [
          `${row.item.repositoryId}:${row.pullRequestDetails.headRef}`,
          row,
        ] as const,
    ),
  );

  function parent(row: InboxRow) {
    const details = row.pullRequestDetails;
    return rowByHead.get(`${row.item.repositoryId}:${details.baseRef}`);
  }

  function ancestry(row: InboxRow) {
    const ancestry = [row];
    const seen = new Set([row.item.id]);
    let current = row;
    let next = parent(current);

    while (next && !seen.has(next.item.id)) {
      ancestry.unshift(next);
      seen.add(next.item.id);
      current = next;
      next = parent(current);
    }

    return ancestry;
  }

  const groups = new Map<string, InboxRow[]>();
  for (const row of rows) {
    const rootId = ancestry(row)[0].item.id;
    groups.set(rootId, [...(groups.get(rootId) ?? []), row]);
  }

  return Array.from(groups.values())
    .map((group) => ({
      rows: group.sort((a, b) => {
        const depth = ancestry(a).length - ancestry(b).length;
        return depth || b.item.updatedAt - a.item.updatedAt;
      }),
      sectionId: group
        .map((row) => classifyInboxSection(row, now))
        .sort(
          (a, b) => (sectionRank.get(a) ?? 0) - (sectionRank.get(b) ?? 0),
        )[0],
    }))
    .sort(
      (a, b) =>
        (sectionRank.get(a.sectionId) ?? 0) -
          (sectionRank.get(b.sectionId) ?? 0) ||
        Math.max(...b.rows.map((row) => row.item.updatedAt)) -
          Math.max(...a.rows.map((row) => row.item.updatedAt)),
    );
}
