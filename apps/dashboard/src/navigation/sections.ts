export type SectionId = "start" | "runs" | "graph" | "candidates" | "rehearsal" | "approvals";

export type Section = {
  id: SectionId;
  label: string;
  description: string;
};

export const SECTIONS: readonly Section[] = [
  { id: "start", label: "New run", description: "Connect the infrastructure, pick the project and start a run." },
  { id: "runs", label: "Runs", description: "Follow a run and its decisions." },
  { id: "graph", label: "Graph", description: "The infrastructure graph and its dependencies." },
  { id: "candidates", label: "Candidates", description: "Cost, availability, risk and effort for every plan." },
  { id: "rehearsal", label: "Rehearsal", description: "Traffic and failure results for the chosen layout." },
  { id: "approvals", label: "Approvals", description: "Approve analyses, layouts and plans." },
];

export function sectionById(id: SectionId): Section {
  return SECTIONS.find((section) => section.id === id) ?? SECTIONS[0];
}
