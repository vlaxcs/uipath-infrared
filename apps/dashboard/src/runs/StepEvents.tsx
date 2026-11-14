import type { RunEvent } from "~/runs/types";
import { eventStatusMeta, formatActor, gateMeta } from "~/runs/status";
import { formatTime } from "~/runs/format";
import { DecisionDetails } from "~/runs/DecisionDetails";
import { StatusBadge } from "~/ui/StatusBadge";

export function StepEvents({ events }: { events: readonly RunEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label font-semibold">Events</h3>
      <ol className="flex flex-col gap-2">
        {events.map((event) => {
          const status = eventStatusMeta[event.status];
          return (
            <li key={event.seq} className="flex flex-col gap-1 rounded-control border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-caption text-fg-subtle">#{event.seq}</span>
                <time dateTime={event.at} className="text-caption text-fg-subtle">
                  {formatTime(event.at)}
                </time>
                <StatusBadge label={status.label} tone={status.tone} />
                <span className="text-caption text-fg-muted">{formatActor(event.actor)}</span>
              </div>
              {event.gate ? (
                <p className="text-caption text-status-awaiting">Gate: {gateMeta[event.gate].label}</p>
              ) : null}
              {event.decision ? <DecisionDetails decision={event.decision} /> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
