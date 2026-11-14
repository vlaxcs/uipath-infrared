import type { RunEvent } from "~/runs/types";
import { shortHash, formatTime } from "~/runs/format";
import { eventStatusMeta, formatActor, gateMeta } from "~/runs/status";
import { DecisionDetails } from "~/runs/DecisionDetails";
import { StatusBadge } from "~/ui/StatusBadge";

export function TimelineEvent({ event }: { event: RunEvent }) {
  const status = eventStatusMeta[event.status];

  return (
    <li className="flex flex-col gap-2 border-l border-border pl-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-caption text-fg-subtle">#{event.seq}</span>
        <time dateTime={event.at} className="text-caption text-fg-subtle">
          {formatTime(event.at)}
        </time>
        <span className="text-label font-medium capitalize">{event.step}</span>
        <StatusBadge label={status.label} tone={status.tone} />
        <span className="text-caption text-fg-muted">{formatActor(event.actor)}</span>
      </div>

      {event.gate ? <p className="text-caption text-status-awaiting">Gate: {gateMeta[event.gate].label}</p> : null}
      {event.decision ? <DecisionDetails decision={event.decision} /> : null}

      {event.output ? (
        <p className="break-all text-caption text-fg-subtle">
          {event.output.contract}: <span className="font-mono">{event.output.file.path}</span>{" "}
          <span className="font-mono">{shortHash(event.output.file.sha256)}</span>
        </p>
      ) : null}
    </li>
  );
}
