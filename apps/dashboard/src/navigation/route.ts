import { SECTIONS, type SectionId } from "~/navigation/sections";

export type Route = {
  section: SectionId;
  runId: string | null;
  focusGate: boolean;
};

const SECTION_IDS = new Set<string>(SECTIONS.map((section) => section.id));
export const RUN_DATA_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>(["graph", "candidates", "rehearsal"]);

export function readRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const known = parts[0] !== undefined && SECTION_IDS.has(parts[0]);
  const section: SectionId = known ? (parts[0] as SectionId) : "runs";
  const carriesRun = section === "runs" || RUN_DATA_SECTIONS.has(section);
  const runId = known && carriesRun && parts[1] ? decode(parts[1]) : null;

  return { section, runId, focusGate: section === "runs" && runId !== null && parts[2] === "gate" };
}

export function routeHash(route: Route): string {
  const run = route.runId ? `/${encodeURIComponent(route.runId)}` : "";
  const gate = route.runId && route.focusGate ? "/gate" : "";
  return `#/${route.section}${run}${gate}`;
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
