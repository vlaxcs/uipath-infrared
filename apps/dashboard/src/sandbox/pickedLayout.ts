import type { RunDetail } from "~/runs/types";

export function latestPickedLayout(run: Pick<RunDetail, "events">): string | null {
  for (let index = run.events.length - 1; index >= 0; index -= 1) {
    const decision = run.events[index].decision;
    if (decision?.kind === "pick_layout" && decision.layout) return decision.layout;
  }
  return null;
}
