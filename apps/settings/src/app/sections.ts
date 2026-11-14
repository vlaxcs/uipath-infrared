export type SectionId = "subscription" | "cloud" | "github";

export interface Section {
  id: SectionId;
  label: string;
  summary: string;
}

export const SECTIONS: Section[] = [
  { id: "subscription", label: "Subscription", summary: "Plan, payment method and invoices" },
  { id: "cloud", label: "Cloud access", summary: "Read-only access to your AWS accounts" },
  { id: "github", label: "GitHub", summary: "Organisation connection for the extension" },
];

export function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#\/?/, "");
  return SECTIONS.find((section) => section.id === id)?.id ?? "subscription";
}
