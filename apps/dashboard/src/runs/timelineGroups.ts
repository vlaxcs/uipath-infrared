import type { RunEvent } from "~/runs/types";

export type RevisionGroup = {
  revision: number;
  label: string;
  events: RunEvent[];
};

export function groupEventsByRevision(events: readonly RunEvent[]): RevisionGroup[] {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const groups = new Map<number, RunEvent[]>();

  for (const event of ordered) {
    const group = groups.get(event.revision) ?? [];
    group.push(event);
    groups.set(event.revision, group);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([revision, groupEvents]) => ({
      revision,
      label: revision === 0 ? "Initial pass" : `Revision ${revision}`,
      events: groupEvents,
    }));
}
