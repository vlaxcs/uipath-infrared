import {
  ADDED_RESOURCES,
  CURRENT_TOTAL,
  MOVED_RESOURCES,
  PLANNED_TOTAL,
  PROJECTS,
  REMOVED_RESOURCES,
  RESOURCES,
  RIGHTSIZED_RESOURCES,
  currentProjectTotal,
  currentZones,
  plannedProjectTotal,
  plannedZones,
  type ProjectId,
} from "./estate";

export type Tone = "muted" | "strong" | "warm" | "cool" | "ice";
export type Segment = { text: string; tone?: Tone };
export type LineKind = "prompt" | "blank" | "heading" | "ok" | "project" | "diff" | "step" | "status";

export type TerminalLine = {
  id: string;
  text: string;
  segments: Segment[];
  kind: LineKind;
  diff?: "-" | "+" | "~";
  resourceIds: string[];
  projectIds: ProjectId[];
  focusable: boolean;
};

export const PROMPT = "$ infrared run demo-shop --read-only";

const formatK = (value: number) => `${value.toFixed(1)}k`;
const savingsK = (value: number) => `-${Math.abs(value).toFixed(1)}k`;

function makeLine(
  id: string,
  segments: Segment[],
  extra: Omit<TerminalLine, "id" | "text" | "segments">,
): TerminalLine {
  return { id, segments, text: segments.map((segment) => segment.text).join(""), ...extra };
}

const movedSavings = MOVED_RESOURCES.reduce((sum, resource) => sum + resource.cost - resource.plannedCost, 0);
const rightsizedSavings = RIGHTSIZED_RESOURCES.reduce((sum, resource) => sum + resource.cost - resource.plannedCost, 0);
const removedSavings = REMOVED_RESOURCES.reduce((sum, resource) => sum + resource.cost, 0);
const addedCost = ADDED_RESOURCES.reduce((sum, resource) => sum + resource.plannedCost, 0);
const totalSavings = CURRENT_TOTAL - PLANNED_TOTAL;
const savingsPercent = (totalSavings / CURRENT_TOTAL) * 100;

const currentZoneCount = PROJECTS.reduce((sum, project) => sum + currentZones(project.id).length, 0);
const plannedZoneCount = PROJECTS.reduce((sum, project) => sum + plannedZones(project.id).length, 0);
const zoneGains = PROJECTS.flatMap((project) => {
  const gained = plannedZones(project.id).length - currentZones(project.id).length;
  return gained > 0 ? [`${project.label} +${gained}`] : [];
});

const projectLineIds = Object.fromEntries(PROJECTS.map((project) => [project.id, `project-${project.id}`])) as Record<
  ProjectId,
  string
>;

export const PROJECT_DELTA_LINES: TerminalLine[] = PROJECTS.map((project) => {
  const current = currentProjectTotal(project.id);
  const planned = plannedProjectTotal(project.id);
  const difference = planned - current;
  const zonesNow = currentZones(project.id).length;
  const zonesNext = plannedZones(project.id).length;
  return makeLine(
    projectLineIds[project.id],
    [
      { text: "~ ", tone: "ice" },
      { text: project.label.padEnd(9), tone: "strong" },
      { text: formatK(current), tone: "muted" },
      { text: " -> ", tone: "muted" },
      { text: formatK(planned), tone: "strong" },
      { text: "  zones ", tone: "muted" },
      { text: `${zonesNow}->${zonesNext}`, tone: zonesNext > zonesNow ? "ice" : "muted" },
      {
        text: `  ${difference <= 0 ? savingsK(difference) : `+${difference.toFixed(1)}k`}`,
        tone: difference <= 0 ? "cool" : "warm",
      },
    ],
    {
      kind: "project",
      diff: "~",
      resourceIds: RESOURCES.filter(
        (resource) => (resource.added ? resource.plannedProject : resource.project) === project.id,
      ).map((resource) => resource.id),
      projectIds: [project.id],
      focusable: true,
    },
  );
});

const movedProjects = [...new Set(MOVED_RESOURCES.map((resource) => resource.project))];
const rightsizedProjects = [...new Set(RIGHTSIZED_RESOURCES.map((resource) => resource.project))];
const changedProjects = [...new Set([...movedProjects, ...rightsizedProjects, "media" as ProjectId])];

const movedLine = makeLine(
  "change-moved",
  [
    { text: "~ ", tone: "ice" },
    { text: `${MOVED_RESOURCES.length} shared services`, tone: "strong" },
    { text: " -> shared  ", tone: "muted" },
    { text: savingsK(movedSavings), tone: "cool" },
    { text: " USD/mo", tone: "muted" },
  ],
  {
    kind: "diff",
    diff: "~",
    resourceIds: MOVED_RESOURCES.map((resource) => resource.id),
    projectIds: movedProjects,
    focusable: true,
  },
);

const rightsizedLine = makeLine(
  "change-rightsized",
  [
    { text: "~ ", tone: "ice" },
    { text: `${RIGHTSIZED_RESOURCES.length} resources rightsized`, tone: "strong" },
    { text: "     ", tone: "muted" },
    { text: savingsK(rightsizedSavings), tone: "cool" },
    { text: " USD/mo", tone: "muted" },
  ],
  {
    kind: "diff",
    diff: "~",
    resourceIds: RIGHTSIZED_RESOURCES.map((resource) => resource.id),
    projectIds: rightsizedProjects,
    focusable: true,
  },
);

const removedLine = makeLine(
  "change-removed",
  [
    { text: "- ", tone: "warm" },
    { text: `${REMOVED_RESOURCES.length} idle media resources`, tone: "warm" },
    { text: "       ", tone: "muted" },
    { text: savingsK(removedSavings), tone: "cool" },
    { text: " USD/mo", tone: "muted" },
  ],
  {
    kind: "diff",
    diff: "-",
    resourceIds: REMOVED_RESOURCES.map((resource) => resource.id),
    projectIds: ["media"],
    focusable: true,
  },
);

const addedLine = makeLine(
  "change-added",
  [
    { text: "+ ", tone: "cool" },
    { text: `${ADDED_RESOURCES.length} postgres replicas`, tone: "strong" },
    { text: "        ", tone: "muted" },
    { text: `+${addedCost.toFixed(1)}k`, tone: "warm" },
    { text: " USD/mo", tone: "muted" },
  ],
  {
    kind: "diff",
    diff: "+",
    resourceIds: ADDED_RESOURCES.map((resource) => resource.id),
    projectIds: ["shared"],
    focusable: true,
  },
);

const zonesLine = makeLine(
  "change-zones",
  [
    { text: "+ ", tone: "ice" },
    { text: "zone footprint", tone: "strong" },
    { text: "       ", tone: "muted" },
    { text: zoneGains.join(", "), tone: "ice" },
  ],
  {
    kind: "diff",
    diff: "+",
    resourceIds: [],
    projectIds: PROJECTS.filter((project) => plannedZones(project.id).length > currentZones(project.id).length).map(
      (project) => project.id,
    ),
    focusable: true,
  },
);

const currentLines: TerminalLine[] = [
  makeLine(
    "current-layout",
    [
      { text: "current layout  ", tone: "strong" },
      { text: "demo-shop  ", tone: "muted" },
      {
        text: `${PROJECTS.length} projects / ${RESOURCES.filter((resource) => !resource.added).length} resources / ${formatK(CURRENT_TOTAL)} USD/mo / zones ${currentZoneCount}`,
        tone: "muted",
      },
    ],
    { kind: "project", resourceIds: [], projectIds: [], focusable: false },
  ),
];

const aiResourceCount = RESOURCES.filter((resource) => resource.project === "llm" && !resource.added).length;

const sourceLines: TerminalLine[] = [
  makeLine(
    "source-0",
    [
      { text: "ok  ", tone: "cool" },
      { text: "aws + cloudwatch + postgres", tone: "strong" },
      { text: "   220 resources / usage / 84 tables", tone: "muted" },
    ],
    { kind: "ok", resourceIds: [], projectIds: [], focusable: false },
  ),
  makeLine(
    "source-1",
    [
      { text: "ok  ", tone: "cool" },
      { text: "github + ai usage + price lists", tone: "strong" },
      { text: `   6 runners / ${aiResourceCount} resources / 6 providers`, tone: "muted" },
    ],
    { kind: "ok", resourceIds: [], projectIds: [], focusable: false },
  ),
];

const steps = [
  ["01", "open pull request", "orders/shared", "ready"],
  ["02", "human approval", "required", "waiting"],
  ["03", "ci apply", "client ci", "waiting"],
  ["04", "re-read + compare", "after merge", "waiting"],
] as const;

const stepLines: TerminalLine[] = steps.map(([number, action, owner, status], index) =>
  makeLine(
    `step-${index}`,
    [
      { text: number, tone: "ice" },
      { text: "  ", tone: "muted" },
      { text: action.padEnd(20), tone: "strong" },
      { text: owner.padEnd(16), tone: "muted" },
      { text: status, tone: status === "ready" ? "cool" : "muted" },
    ],
    { kind: "step", resourceIds: [], projectIds: [], focusable: false },
  ),
);

const heading = (id: string, text: string): TerminalLine => makeLine(id, [{ text, tone: "strong" }], {
  kind: "heading",
  resourceIds: [],
  projectIds: [],
  focusable: false,
});

export const TERMINAL_LINES: TerminalLine[] = [
  makeLine("prompt", [{ text: PROMPT, tone: "strong" }], {
    kind: "prompt",
    resourceIds: [],
    projectIds: [],
    focusable: false,
  }),
  heading("heading-sources", "sources selected"),
  ...sourceLines,
  ...currentLines,
  heading("heading-proposed", "proposed layout"),
  ...PROJECT_DELTA_LINES,
  movedLine,
  rightsizedLine,
  removedLine,
  addedLine,
  zonesLine,
  heading("heading-cost", "cost delta"),
  makeLine(
    "cost-delta",
    [
      { text: "~ ", tone: "ice" },
      { text: "cost", tone: "strong" },
      { text: `  ${formatK(CURRENT_TOTAL)} -> ${formatK(PLANNED_TOTAL)} USD/mo  `, tone: "muted" },
      { text: `${savingsK(totalSavings)} (${savingsPercent.toFixed(1)}%)`, tone: "cool" },
    ],
    {
      kind: "diff",
      diff: "~",
      resourceIds: RESOURCES.filter((resource) => resource.moved || resource.rightsized || resource.removed || resource.added).map(
        (resource) => resource.id,
      ),
      projectIds: changedProjects,
      focusable: false,
    },
  ),
  heading("heading-availability", "availability delta"),
  makeLine(
    "availability-delta",
    [
      { text: "+ ", tone: "ice" },
      { text: "zones", tone: "strong" },
      { text: `  ${currentZoneCount} -> ${plannedZoneCount}  `, tone: "muted" },
      { text: zoneGains.join(", "), tone: "ice" },
    ],
    {
      kind: "diff",
      diff: "+",
      resourceIds: [],
      projectIds: PROJECTS.filter((project) => plannedZones(project.id).length > currentZones(project.id).length).map(
        (project) => project.id,
      ),
      focusable: false,
    },
  ),
  heading("heading-steps", "implementation steps"),
  ...stepLines,
];

export const TERMINAL_TEXT = TERMINAL_LINES.map((line) => line.text).join("\n");

const lineIdsByResource = new Map<string, string[]>();
for (const line of TERMINAL_LINES) {
  for (const resourceId of line.resourceIds) {
    const ids = lineIdsByResource.get(resourceId) ?? [];
    if (!ids.includes(line.id)) ids.push(line.id);
    lineIdsByResource.set(resourceId, ids);
  }
}

export function lineIdsForResource(resourceId: string) {
  return lineIdsByResource.get(resourceId) ?? [];
}

export function resourceLabel(id: string) {
  const resource = RESOURCES.find((entry) => entry.id === id);
  if (!resource) return id;
  const project = resource.added ? resource.plannedProject : resource.project;
  return `${project}/${resource.name}`;
}
