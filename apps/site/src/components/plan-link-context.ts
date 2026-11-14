import { createContext, useContext } from "react";
import type { TerminalLine } from "../data/run";
import type { ProjectId, Resource } from "../data/estate";

export type PlanSelection = {
  source: "line" | "node" | null;
  lineIds: string[];
  resourceIds: string[];
  projectIds: ProjectId[];
};

export type PlanLinkValue = {
  selection: PlanSelection;
  selectLine: (line: TerminalLine) => void;
  clearLine: (lineId: string) => void;
  selectNode: (resource: Resource) => void;
  clearNode: (resourceId: string) => void;
};

export const PlanLinkContext = createContext<PlanLinkValue | null>(null);

export function usePlanLink() {
  const value = useContext(PlanLinkContext);
  if (!value) throw new Error("usePlanLink must be used inside PlanLinkProvider");
  return value;
}
