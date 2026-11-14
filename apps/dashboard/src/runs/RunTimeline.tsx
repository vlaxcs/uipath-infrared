import type { RunDetail } from "~/runs/types";
import { groupEventsByRevision } from "~/runs/timelineGroups";
import { TimelineEvent } from "~/runs/TimelineEvent";

export function RunTimeline({ run }: { run: RunDetail }) {
  const groups = groupEventsByRevision(run.events);

  return (
    <section aria-labelledby="timeline-title" className="flex flex-col gap-6">
      <h2 id="timeline-title" className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
        Timeline
      </h2>
      {groups.length === 0 ? <p className="text-body text-fg-muted">No events yet.</p> : null}
      {groups.map((group) => (
        <section key={group.revision} aria-labelledby={`revision-${group.revision}`} className="flex flex-col gap-3">
          <h3 id={`revision-${group.revision}`} className="text-title font-semibold">
            {group.label}
          </h3>
          <ol className="flex flex-col gap-4">
            {group.events.map((event) => (
              <TimelineEvent key={event.seq} event={event} />
            ))}
          </ol>
        </section>
      ))}
    </section>
  );
}
