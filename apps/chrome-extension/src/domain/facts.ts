import type { RunEvent } from "~/domain/types";

export function latestArtifactPaths(events: readonly RunEvent[]): {
  result: string | null;
  infra: string | null;
} {
  let result: string | null = null;
  let infra: string | null = null;

  for (const event of [...events].sort((left, right) => left.seq - right.seq)) {
    if (event.output?.contract === "result") result = event.output.file.path;
    if (event.output?.contract === "infra") infra = event.output.file.path;
  }

  return { result, infra };
}

export function pickedLayout(events: readonly RunEvent[]): string | null {
  let layout: string | null = null;
  for (const event of [...events].sort((left, right) => left.seq - right.seq)) {
    if (event.decision?.kind === "pick_layout" && event.decision.layout) {
      layout = event.decision.layout;
    }
  }
  return layout;
}
