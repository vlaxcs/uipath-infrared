import { useCallback, useMemo, useState, type ReactNode } from "react";
import { lineIdsForResource, type TerminalLine } from "../data/run";
import type { Resource } from "../data/estate";
import {
  PlanLinkContext,
  type PlanLinkValue,
  type PlanSelection,
} from "./plan-link-context";

const EMPTY: PlanSelection = { source: null, lineIds: [], resourceIds: [], projectIds: [] };

export function PlanLinkProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<PlanSelection>(EMPTY);

  const selectLine = useCallback((line: TerminalLine) => {
    setSelection({
      source: "line",
      lineIds: [line.id],
      resourceIds: line.resourceIds,
      projectIds: line.projectIds,
    });
  }, []);

  const clearLine = useCallback((lineId: string) => {
    setSelection((current) =>
      current.source === "line" && current.lineIds.includes(lineId) ? EMPTY : current,
    );
  }, []);

  const selectNode = useCallback((resource: Resource) => {
    const project = resource.added ? resource.plannedProject : resource.project;
    setSelection({
      source: "node",
      lineIds: lineIdsForResource(resource.id),
      resourceIds: [resource.id],
      projectIds: [project],
    });
  }, []);

  const clearNode = useCallback((resourceId: string) => {
    setSelection((current) =>
      current.source === "node" && current.resourceIds.includes(resourceId) ? EMPTY : current,
    );
  }, []);

  const value = useMemo<PlanLinkValue>(
    () => ({ selection, selectLine, clearLine, selectNode, clearNode }),
    [selection, selectLine, clearLine, selectNode, clearNode],
  );

  return <PlanLinkContext.Provider value={value}>{children}</PlanLinkContext.Provider>;
}
