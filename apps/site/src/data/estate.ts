export type ProjectId = "orders" | "billing" | "search" | "llm" | "shared" | "media";
export type Provider = "aws" | "gcp" | "azure" | "supabase" | "onprem" | "cloudflare";

export const PROVIDERS: Record<Provider, { label: string; color: string }> = {
  aws: { label: "AWS", color: "#f0a878" },
  gcp: { label: "GCP", color: "#a9d4ee" },
  azure: { label: "Azure", color: "#a99be0" },
  supabase: { label: "Supabase", color: "#b5d98e" },
  onprem: { label: "on-prem", color: "#e8918f" },
  cloudflare: { label: "Cloudflare", color: "#96d8ce" },
};

export const THERMAL = ["#2b1b5a", "#7a1f7a", "#c2255c", "#ef3b24", "#f5922b", "#ffd36b", "#fff4d6"];

export const PROJECTS: {
  id: ProjectId;
  label: string;
  provider: Provider;
  center: [number, number];
  count: number;
  bases: string[];
}[] = [
  {
    id: "orders",
    label: "orders",
    provider: "aws",
    center: [290, 300],
    count: 220,
    bases: ["api", "orders-db", "cache", "queue", "worker", "index", "events", "storage"],
  },
  {
    id: "billing",
    label: "billing",
    provider: "onprem",
    center: [530, 455],
    count: 90,
    bases: ["billing-api", "billing-db", "ledger", "invoices", "queue", "cache", "webhook", "reports"],
  },
  {
    id: "search",
    label: "search",
    provider: "azure",
    center: [710, 330],
    count: 55,
    bases: ["search-api", "index", "query", "cache", "suggest", "crawler", "logs", "geo"],
  },
  {
    id: "llm",
    label: "llm",
    provider: "gcp",
    center: [830, 160],
    count: 30,
    bases: ["inference", "gpu", "vector-db", "tokens", "queue", "cache", "eval", "gateway"],
  },
  {
    id: "shared",
    label: "shared",
    provider: "supabase",
    center: [510, 175],
    count: 16,
    bases: ["gateway", "cache", "queue", "logs", "auth", "cdn", "metrics", "events"],
  },
  {
    id: "media",
    label: "media",
    provider: "cloudflare",
    center: [165, 470],
    count: 9,
    bases: ["cdn", "images", "video", "thumbnails", "storage", "edge", "logs", "transform"],
  },
];

const SHARED_BASE = /(cache|queue|logs|gateway|cdn|auth|metrics|events)/;

export const SATELLITES: {
  id: string;
  project: ProjectId;
  center: [number, number];
  count: number;
  bases: string[];
}[] = [
  { id: "llm-edge", project: "llm", center: [640, 78], count: 7, bases: ["edge", "gateway", "queue"] },
  { id: "search-edge", project: "search", center: [930, 510], count: 6, bases: ["geo", "suggest", "crawler"] },
  { id: "media-edge", project: "media", center: [82, 250], count: 5, bases: ["edge", "thumbnails", "images"] },
  { id: "shared-edge", project: "shared", center: [700, 215], count: 6, bases: ["auth", "metrics", "events"] },
];

export type Resource = {
  id: string;
  name: string;
  group: string;
  project: ProjectId;
  provider: Provider;
  cost: number;
  waste: number;
  zone: string;
  plannedProject: ProjectId;
  plannedProvider: Provider;
  plannedCost: number;
  plannedWaste: number;
  plannedZone: string;
  moved: boolean;
  rightsized: boolean;
  removed: boolean;
  added: boolean;
};

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function zonesFor(project: ProjectId, index: number, planned: boolean) {
  if (planned) {
    if (project === "orders") return index % 2 === 0 ? "eu-central-1a" : "eu-central-1b";
    if (project === "billing") return index % 2 === 0 ? "lab-a" : "lab-b";
    if (project === "shared") return index % 3 === 0 ? "eu-central-1b" : "eu-central-1";
    if (project === "search") return "westeurope-1";
    if (project === "llm") return "europe-west3-a";
    return "global";
  }
  if (project === "orders") return "eu-central-1a";
  if (project === "billing") return "lab-a";
  if (project === "shared") return "eu-central-1";
  if (project === "search") return "westeurope-1";
  if (project === "llm") return "europe-west3-a";
  return "global";
}

function buildResources(): Resource[] {
  const random = seeded(17011986);
  const resources: Resource[] = [];

  for (const project of PROJECTS) {
    for (let index = 0; index < project.count; index++) {
      const hub = index < 3;
      const cost = hub ? 1.4 + random() * 1.8 : 0.02 + Math.pow(random(), 5) * 0.55;
      const waste = Math.min(0.96, (hub ? 0.24 : 0.08) + Math.pow(random(), 1.4) * 0.78);
      const base = project.bases[index % project.bases.length];
      const zone = zonesFor(project.id, index, false);
      resources.push({
        id: `${project.id}-${index}`,
        name: `${base}-${index + 1}`,
        group: project.id,
        project: project.id,
        provider: project.provider,
        cost,
        waste,
        zone,
        plannedProject: project.id,
        plannedProvider: project.provider,
        plannedCost: cost,
        plannedWaste: waste,
        plannedZone: zonesFor(project.id, index, true),
        moved: false,
        rightsized: false,
        removed: false,
        added: false,
      });
    }
  }

  for (const satellite of SATELLITES) {
    const project = PROJECTS.find((entry) => entry.id === satellite.project)!;
    for (let index = 0; index < satellite.count; index++) {
      const cost = 0.02 + Math.pow(random(), 5) * 0.36;
      const waste = Math.min(0.9, 0.08 + Math.pow(random(), 1.5) * 0.72);
      const base = satellite.bases[index % satellite.bases.length];
      resources.push({
        id: `${satellite.id}-${index}`,
        name: `${base}-${index + 1}`,
        group: satellite.id,
        project: satellite.project,
        provider: project.provider,
        cost,
        waste,
        zone: zonesFor(satellite.project, index, false),
        plannedProject: satellite.project,
        plannedProvider: project.provider,
        plannedCost: cost,
        plannedWaste: waste,
        plannedZone: zonesFor(satellite.project, index, true),
        moved: false,
        rightsized: false,
        removed: false,
        added: false,
      });
    }
  }

  const moveable = resources
    .filter(
      (resource) =>
        resource.group === resource.project && resource.project !== "shared" && SHARED_BASE.test(resource.name),
    )
    .sort((first, second) => second.waste - first.waste)
    .slice(0, 28);
  const moving = new Set(moveable.map((resource) => resource.id));
  const rightSizeCandidates = resources
    .filter(
      (resource) =>
        resource.group === resource.project && !moving.has(resource.id) && resource.waste > 0.62,
    )
    .sort((first, second) => second.waste - first.waste)
    .slice(0, 48);
  const rightsized = new Set(rightSizeCandidates.map((resource) => resource.id));
  const removed = new Set(resources.filter((resource) => resource.project === "media" && resource.group === "media").slice(5).map((resource) => resource.id));

  const planned = resources.map((resource) => {
    if (removed.has(resource.id)) {
      return {
        ...resource,
        removed: true,
        plannedCost: 0,
        plannedWaste: 0,
        plannedZone: resource.zone,
      };
    }
    if (moving.has(resource.id)) {
      return {
        ...resource,
        moved: true,
        plannedProject: "shared" as ProjectId,
        plannedProvider: "supabase" as Provider,
        plannedCost: resource.cost * 0.7,
        plannedWaste: resource.waste * 0.45,
        plannedZone: "eu-central-1",
      };
    }
    if (rightsized.has(resource.id)) {
      return {
        ...resource,
        rightsized: true,
        plannedCost: resource.cost * 0.85,
        plannedWaste: resource.waste * 0.58,
      };
    }
    return resource;
  });

  const replicas: Resource[] = [0, 1].map((index) => ({
    id: `shared-added-${index}`,
    name: `replica-${index + 1}`,
    group: "shared",
    project: "shared",
    provider: "supabase",
    cost: 0,
    waste: 0,
    zone: "eu-central-1",
    plannedProject: "shared",
    plannedProvider: "supabase",
    plannedCost: 0.06,
    plannedWaste: 0.04,
    plannedZone: index === 0 ? "eu-central-1" : "eu-central-1b",
    moved: false,
    rightsized: false,
    removed: false,
    added: true,
  }));

  return [...planned, ...replicas];
}

export const RESOURCES = buildResources();
export const CURRENT_RESOURCES = RESOURCES.filter((resource) => !resource.added);
export const PLANNED_RESOURCES = RESOURCES.filter((resource) => !resource.removed);
export const MOVED_RESOURCES = RESOURCES.filter((resource) => resource.moved);
export const RIGHTSIZED_RESOURCES = RESOURCES.filter((resource) => resource.rightsized);
export const REMOVED_RESOURCES = RESOURCES.filter((resource) => resource.removed);
export const ADDED_RESOURCES = RESOURCES.filter((resource) => resource.added);

export const CURRENT_TOTAL = CURRENT_RESOURCES.reduce((sum, resource) => sum + resource.cost, 0);
export const PLANNED_TOTAL = PLANNED_RESOURCES.reduce((sum, resource) => sum + resource.plannedCost, 0);

export function projectResources(project: ProjectId) {
  return CURRENT_RESOURCES.filter((resource) => resource.project === project);
}

export function currentProjectTotal(project: ProjectId) {
  return projectResources(project).reduce((sum, resource) => sum + resource.cost, 0);
}

export function plannedProjectTotal(project: ProjectId) {
  return PLANNED_RESOURCES.filter((resource) => resource.plannedProject === project).reduce(
    (sum, resource) => sum + resource.plannedCost,
    0,
  );
}

export function currentZones(project: ProjectId) {
  return [...new Set(projectResources(project).map((resource) => resource.zone))];
}

export function plannedZones(project: ProjectId) {
  return [
    ...new Set(
      PLANNED_RESOURCES.filter((resource) => resource.plannedProject === project).map((resource) => resource.plannedZone),
    ),
  ];
}

export const projectCenter = (project: ProjectId) => PROJECTS.find((entry) => entry.id === project)!.center;
