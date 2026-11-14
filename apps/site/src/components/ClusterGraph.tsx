import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  CURRENT_RESOURCES,
  CURRENT_TOTAL,
  PLANNED_TOTAL,
  PROJECTS,
  PROVIDERS,
  RESOURCES,
  SATELLITES,
  THERMAL,
  projectCenter,
  type ProjectId,
  type Resource,
} from "../data/estate";
import { ProjectDeltaStrip } from "./PlanLines";
import { usePlanLink } from "./plan-link-context";

const WORLD = { width: 1000, height: 600 };

type SimNode = SimulationNodeDatum &
  Resource & {
    layoutGroup: string;
    layoutProject: ProjectId;
    layoutCost: number;
    r: number;
  };

type SimLink = SimulationLinkDatum<SimNode> & { project: ProjectId };
type Point = { x: number; y: number };
type LayoutLink = { source: string; target: string; project: ProjectId };
type Layout = {
  positions: Map<string, Point>;
  radii: Map<string, number>;
  totals: Record<ProjectId, number>;
  centroids: Record<ProjectId, Point>;
  links: LayoutLink[];
};

function buildLayout(resources: Resource[], planned: boolean): Layout {
  const random = seeded(90321);
  const included = resources.filter((resource) => (planned ? !resource.removed : !resource.added));
  const groupOf = (resource: Resource) => (planned && resource.moved ? resource.plannedProject : resource.group);
  const groupCounts = new Map<string, number>();
  for (const resource of included) {
    const group = groupOf(resource);
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  }
  const centerOf = (group: string, project: ProjectId): [number, number] =>
    SATELLITES.find((satellite) => satellite.id === group)?.center ?? projectCenter(project);
  const satelliteGroups = new Set(SATELLITES.map((satellite) => satellite.id));

  const nodes: SimNode[] = included.map((resource) => {
    const project = planned ? resource.plannedProject : resource.project;
    const group = groupOf(resource);
    const cost = planned ? resource.plannedCost : resource.cost;
    const center = centerOf(group, project);
    const hub = cost > 0.9;
    const count = groupCounts.get(group) ?? 1;
    const spread = satelliteGroups.has(group) ? 26 : hub ? 55 : 60 + Math.sqrt(count) * 8;
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * spread;
    return {
      ...resource,
      layoutGroup: group,
      layoutProject: project,
      layoutCost: cost,
      r: Math.min(18, 2 + Math.sqrt(cost) * 4.4),
      x: center[0] + Math.cos(angle) * distance,
      y: center[1] + Math.sin(angle) * distance,
    };
  });

  const byGroup = new Map<string, SimNode[]>();
  for (const node of nodes) {
    const list = byGroup.get(node.layoutGroup) ?? [];
    list.push(node);
    byGroup.set(node.layoutGroup, list);
  }

  const links: SimLink[] = [];
  const drawLinks: LayoutLink[] = [];
  for (const nodesInGroup of byGroup.values()) {
    for (const node of nodesInGroup) {
      const nearest = nodesInGroup
        .filter((other) => other.id !== node.id)
        .map((other) => ({
          other,
          distance: Math.hypot((other.x ?? 0) - (node.x ?? 0), (other.y ?? 0) - (node.y ?? 0)),
        }))
        .sort((first, second) => first.distance - second.distance)
        .slice(0, 3);
      for (const { other } of nearest) {
        links.push({ source: node.id, target: other.id, project: node.layoutProject });
        drawLinks.push({ source: node.id, target: other.id, project: node.layoutProject });
      }
    }
  }

  const hubs = [...byGroup.entries()]
    .filter(([group]) => !satelliteGroups.has(group))
    .map(([, nodesInGroup]) => nodesInGroup[0]);
  for (let index = 0; index < hubs.length - 1; index++) {
    links.push({ source: hubs[index].id, target: hubs[index + 1].id, project: hubs[index].layoutProject });
    drawLinks.push({ source: hubs[index].id, target: hubs[index + 1].id, project: hubs[index].layoutProject });
  }

  forceSimulation<SimNode>(nodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((node) => node.id)
        .distance((link) => 8 + (link.source as SimNode).r + (link.target as SimNode).r)
        .strength(0.5),
    )
    .force("charge", forceManyBody<SimNode>().strength(-9))
    .force("collide", forceCollide<SimNode>((node) => node.r + 1).iterations(2))
    .force("x", forceX<SimNode>((node) => centerOf(node.layoutGroup, node.layoutProject)[0]).strength(0.075))
    .force("y", forceY<SimNode>((node) => centerOf(node.layoutGroup, node.layoutProject)[1]).strength(0.095))
    .stop()
    .tick(300);

  const positions = new Map<string, Point>();
  const radii = new Map<string, number>();
  const totals = Object.fromEntries(PROJECTS.map((project) => [project.id, 0])) as Record<ProjectId, number>;
  const sums = Object.fromEntries(PROJECTS.map((project) => [project.id, { x: 0, y: 0, count: 0 }])) as Record<
    ProjectId,
    { x: number; y: number; count: number }
  >;

  for (const node of nodes) {
    positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
    radii.set(node.id, node.r);
    totals[node.layoutProject] += node.layoutCost;
    if (node.layoutGroup !== node.layoutProject) continue;
    const sum = sums[node.layoutProject];
    sum.x += node.x ?? 0;
    sum.y += node.y ?? 0;
    sum.count += 1;
  }

  const centroids = Object.fromEntries(
    PROJECTS.map((project) => {
      const sum = sums[project.id];
      return [
        project.id,
        {
          x: sum.count ? sum.x / sum.count : projectCenter(project.id)[0],
          y: sum.count ? sum.y / sum.count : projectCenter(project.id)[1],
        },
      ];
    }),
  ) as Record<ProjectId, Point>;

  return { positions, radii, totals, centroids, links: drawLinks };
}

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

function rgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function mixColor(first: string, second: string, progress: number) {
  if (progress <= 0) return first;
  if (progress >= 1) return second;
  const parse = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const a = parse(first);
  const b = parse(second);
  return `#${a
    .map((value, index) => Math.round(value + (b[index] - value) * progress).toString(16).padStart(2, "0"))
    .join("")}`;
}

function thermal(waste: number) {
  const value = Math.max(0, Math.min(1, waste));
  const scaled = value * (THERMAL.length - 1);
  const index = Math.min(THERMAL.length - 2, Math.floor(scaled));
  return mixColor(THERMAL[index], THERMAL[index + 1], scaled - index);
}

const projectColor = (project: ProjectId) => PROVIDERS[PROJECTS.find((entry) => entry.id === project)!.provider].color;

export type ClusterCopy = {
  title: string;
  lead: string;
  plan: string;
  reset: string;
  infrared: string;
};

export function ClusterGraph({ copy }: { copy: ClusterCopy }) {
  const { selection, selectNode, clearNode } = usePlanLink();
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const progress = useRef(0);
  const target = useRef(0);
  const visible = useRef(true);
  const hovered = useRef<string | null>(null);
  const frame = useRef(0);
  const [planned, setPlanned] = useState(false);
  const [infrared, setInfrared] = useState(false);
  const [readout, setReadout] = useState<{
    id: string;
    project: ProjectId;
    cost: number;
    zone: string;
  } | null>(null);
  const data = useMemo(
    () => ({ current: buildLayout(RESOURCES, false), planned: buildLayout(RESOURCES, true) }),
    [],
  );

  const drawRef = useRef<() => void>(() => {});

  function draw() {
    const element = canvas.current;
    const box = container.current;
    if (!element || !box) return;
    const width = box.clientWidth;
    const height = box.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
    }
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#1b1b1e";
    context.fillRect(0, 0, width, height);

    // The field itself: a grid and a vignette, no decorative chrome.
    context.strokeStyle = "rgba(255,255,255,0.055)";
    context.lineWidth = 1;
    for (let x = 32; x < width; x += 32) {
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
    }
    for (let y = 32; y < height; y += 32) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
      context.stroke();
    }

    const vignette = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.2,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.34)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);

    const pad = 30;
    const toScreen = (position: Point): Point => ({
      x: pad + (position.x / WORLD.width) * (width - pad * 2),
      y: pad + (position.y / WORLD.height) * (height - pad * 2),
    });

    const point = (id: string): Point => {
      const from = data.current.positions.get(id) ?? data.planned.positions.get(id) ?? { x: 0, y: 0 };
      const to = data.planned.positions.get(id) ?? from;
      return toScreen({ x: from.x + (to.x - from.x) * progress.current, y: from.y + (to.y - from.y) * progress.current });
    };
    const radius = (id: string) => {
      const from = data.current.radii.get(id) ?? data.planned.radii.get(id) ?? 2;
      const to = data.planned.radii.get(id) ?? from;
      return Math.min(17, Math.max(2.2, (from + (to - from) * progress.current) * 1.5));
    };

    const selected = selection.source !== null;
    const activeIds = new Set(selection.resourceIds);
    const activeProjects = new Set(selection.projectIds);
    const isActive = (resource: Resource) => {
      if (!selected) return true;
      const project = resource.added ? resource.plannedProject : resource.project;
      if (selection.source === "node") return project === selection.projectIds[0];
      if (activeIds.size) return activeIds.has(resource.id);
      return activeProjects.has(project);
    };
    const activeAlpha = (resource: Resource) => (isActive(resource) ? 1 : 0.1);
    const linkActive = (link: LayoutLink) => {
      if (!selected) return true;
      if (activeIds.size) return activeIds.has(link.source) || activeIds.has(link.target);
      return activeProjects.has(link.project);
    };
    const removedIds = new Set(RESOURCES.filter((resource) => resource.removed).map((resource) => resource.id));
    const addedIds = new Set(RESOURCES.filter((resource) => resource.added).map((resource) => resource.id));

    for (const link of data.current.links) {
      const fades = removedIds.has(link.source) || removedIds.has(link.target);
      if (fades && progress.current > 0.96) continue;
      const from = point(link.source);
      const to = point(link.target);
      const alpha = (linkActive(link) ? 0.17 : 0.04) * (fades ? 1 - progress.current : 1);
      context.strokeStyle = rgba(projectColor(link.project), alpha);
      context.lineWidth = 0.8;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }

    for (const link of data.planned.links) {
      if (!addedIds.has(link.source) && !addedIds.has(link.target)) continue;
      const from = point(link.source);
      const to = point(link.target);
      context.strokeStyle = rgba(projectColor(link.project), (linkActive(link) ? 0.17 : 0.03) * progress.current);
      context.lineWidth = 0.8;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }

    // Ghosts are proposed changes: moves, additions and removals.
    for (const resource of RESOURCES) {
      if (progress.current > 0.94) continue;
      if (!resource.moved && !resource.added && !resource.removed) continue;
      const targetPosition = resource.removed
        ? data.current.positions.get(resource.id)
        : data.planned.positions.get(resource.id);
      if (!targetPosition) continue;
      const screen = toScreen(targetPosition);
      const ghostRadius = Math.min(17, Math.max(2.2, (data.planned.radii.get(resource.id) ?? data.current.radii.get(resource.id) ?? 2) * 1.5));
      const alpha =
        (resource.removed ? 0.7 : 0.58) * (1 - progress.current) * (isActive(resource) ? 1 : 0.22);
      context.strokeStyle = rgba(
        resource.removed ? "#f5922b" : PROVIDERS[resource.plannedProvider].color,
        alpha,
      );
      context.lineWidth = 1.2;
      context.setLineDash(resource.added ? [2, 3] : [4, 4]);
      context.beginPath();
      context.arc(screen.x, screen.y, ghostRadius, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }

    for (const resource of RESOURCES) {
      if (resource.added && progress.current < 0.03) continue;
      if (resource.removed && progress.current > 0.97) continue;
      const position = point(resource.id);
      const nodeRadius = radius(resource.id);
      const baseColor = infrared
        ? thermal(resource.waste + (resource.plannedWaste - resource.waste) * progress.current)
        : mixColor(projectColor(resource.project), projectColor(resource.plannedProject), progress.current);
      let alpha = 0.92 * activeAlpha(resource);
      if (resource.added) alpha *= progress.current;
      if (resource.removed) alpha *= 1 - progress.current;
      if (infrared && resource.waste > 0.62) {
        context.shadowBlur = 12;
        context.shadowColor = baseColor;
      }
      context.fillStyle = rgba(baseColor, alpha);
      context.beginPath();
      context.arc(position.x, position.y, nodeRadius, 0, Math.PI * 2);
      context.fill();
      if (infrared) {
        context.strokeStyle = rgba("#ece8dc", 0.22 * activeAlpha(resource));
        context.lineWidth = 0.7;
        context.stroke();
      }
      context.shadowBlur = 0;

      const ring =
        (selection.source === "node" && hovered.current === resource.id) ||
        (selection.source === "line" && activeIds.has(resource.id) && activeIds.size <= 48);
      if (ring) {
        context.strokeStyle = rgba("#ece8dc", 0.8);
        context.lineWidth = 1.1;
        context.beginPath();
        context.arc(position.x, position.y, nodeRadius + 2, 0, Math.PI * 2);
        context.stroke();
      }
    }

    context.textBaseline = "middle";
    const labelBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const project of PROJECTS) {
      const from = data.current.centroids[project.id];
      const to = data.planned.centroids[project.id];
      const centroid = toScreen({
        x: from.x + (to.x - from.x) * progress.current,
        y: from.y + (to.y - from.y) * progress.current,
      });
      const total =
        data.current.totals[project.id] +
        (data.planned.totals[project.id] - data.current.totals[project.id]) * progress.current;
      const cost = `${total.toFixed(1)}k`;
      context.font = '500 10px "Martian Mono", monospace';
      const nameWidth = context.measureText(project.label).width;
      const costWidth = context.measureText(cost).width;
      const pillHeight = 22;
      const pillWidth = 20 + nameWidth + 8 + costWidth;
      const x = Math.max(pillWidth / 2 + 8, Math.min(width - pillWidth / 2 - 8, centroid.x));
      let y = Math.max(pillHeight / 2 + 8, Math.min(height - pillHeight / 2 - 8, centroid.y - 22));
      let box = { x1: x - pillWidth / 2, y1: y - pillHeight / 2, x2: x + pillWidth / 2, y2: y + pillHeight / 2 };
      for (let attempt = 0; attempt < 6; attempt++) {
        const overlap = labelBoxes.find(
          (placed) => !(box.x2 < placed.x1 || box.x1 > placed.x2 || box.y2 < placed.y1 || box.y1 > placed.y2),
        );
        if (!overlap) break;
        y = overlap.y2 + pillHeight + 4;
        if (y + pillHeight / 2 > height - 8) y = overlap.y1 - pillHeight - 4;
        y = Math.max(pillHeight / 2 + 8, Math.min(height - pillHeight / 2 - 8, y));
        box = { x1: x - pillWidth / 2, y1: y - pillHeight / 2, x2: x + pillWidth / 2, y2: y + pillHeight / 2 };
      }
      labelBoxes.push(box);
      const alpha = selected && !activeProjects.has(project.id) ? 0.3 : 1;
      context.globalAlpha = alpha;
      context.fillStyle = "rgba(18,18,20,0.92)";
      context.strokeStyle = "#303036";
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(x - pillWidth / 2, y - pillHeight / 2, pillWidth, pillHeight, 2);
      context.fill();
      context.stroke();
      context.fillStyle = PROVIDERS[project.provider].color;
      context.beginPath();
      context.arc(x - pillWidth / 2 + 9, y, 2.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#9a978f";
      context.font = '500 10px "Martian Mono", monospace';
      context.fillText(project.label, x - pillWidth / 2 + 16, y + 0.5);
      context.fillStyle = "#ece8dc";
      context.font = '400 11px "Martian Mono", monospace';
      context.fillText(cost, x - pillWidth / 2 + 16 + nameWidth + 8, y + 0.5);
      context.globalAlpha = 1;
    }
  }

  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const box = container.current;
    if (!box) return;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => drawRef.current());
    observer?.observe(box);
    const intersection =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              visible.current = entry.isIntersecting;
              if (!entry.isIntersecting) {
                cancelAnimationFrame(frame.current);
                frame.current = 0;
              } else if (progress.current !== target.current) {
                animateTo(target.current);
              } else {
                drawRef.current();
              }
            },
            { threshold: 0.05 },
          );
    intersection?.observe(box);
    const fonts = document.fonts?.ready ?? Promise.resolve();
    fonts.then(() => drawRef.current());
    requestAnimationFrame(() => drawRef.current());
    return () => {
      observer?.disconnect();
      intersection?.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(() => {
    drawRef.current();
  }, [planned, infrared, selection]);

  function animateTo(next: number) {
    target.current = next;
    const start = progress.current;
    if (start === next) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !visible.current) {
      progress.current = next;
      drawRef.current();
      return;
    }
    cancelAnimationFrame(frame.current);
    const started = performance.now();
    const duration = 1700;
    const tick = (now: number) => {
      if (!visible.current) {
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        return;
      }
      const value = Math.min(1, (now - started) / duration);
      const eased = value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
      progress.current = start + (next - start) * eased;
      drawRef.current();
      if (value < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  function findNode(pointerX: number, pointerY: number) {
    const element = canvas.current;
    if (!element) return null;
    const box = element.getBoundingClientRect();
    const width = box.width;
    const height = box.height;
    const pad = 30;
    let found: Resource | null = null;
    let best = Infinity;
    for (const resource of RESOURCES) {
      if (resource.added && progress.current < 0.03) continue;
      if (resource.removed && progress.current > 0.97) continue;
      const from = data.current.positions.get(resource.id) ?? data.planned.positions.get(resource.id) ?? { x: 0, y: 0 };
      const to = data.planned.positions.get(resource.id) ?? from;
      const px = pad + ((from.x + (to.x - from.x) * progress.current) / WORLD.width) * (width - pad * 2);
      const py = pad + ((from.y + (to.y - from.y) * progress.current) / WORLD.height) * (height - pad * 2);
      const nodeRadius = Math.min(17, Math.max(2.2, (data.current.radii.get(resource.id) ?? 2) * 1.5)) + 9;
      const distance = Math.hypot(px - pointerX, py - pointerY);
      if (distance < nodeRadius && distance < best) {
        best = distance;
        found = resource;
      }
    }
    return found;
  }

  function onPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType !== "mouse") return;
    const element = canvas.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const resource = findNode(event.clientX - box.left, event.clientY - box.top);
    const nextId = resource?.id ?? null;
    if (nextId === hovered.current) return;
    if (hovered.current) clearNode(hovered.current);
    hovered.current = nextId;
    if (!resource) {
      setReadout(null);
      drawRef.current();
      return;
    }
    const project = resource.added ? resource.plannedProject : resource.project;
    const showPlanned = resource.added || progress.current > 0.5;
    const cost = showPlanned ? resource.plannedCost : resource.cost;
    const zone = showPlanned ? resource.plannedZone : resource.zone;
    setReadout({ id: `${project}/${resource.name}`, project, cost, zone });
    selectNode(resource);
    drawRef.current();
  }

  function onLeave() {
    if (hovered.current) clearNode(hovered.current);
    hovered.current = null;
    setReadout(null);
    drawRef.current();
  }

  const minWaste = Math.min(...CURRENT_RESOURCES.map((resource) => resource.waste));
  const maxWaste = Math.max(...CURRENT_RESOURCES.map((resource) => resource.waste));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="relative z-10 flex flex-wrap items-end justify-between gap-6 px-5 pb-5 pt-24 sm:px-8 horizontal:px-[clamp(2.5rem,5vw,5.5rem)] horizontal:pt-[clamp(5rem,12svh,6.5rem)]">
        <div>
          <h2 id="plan-titlu" className="type-h2 max-w-[24ch] text-fg">
            {copy.title}
          </h2>
          <p className="type-lead mt-3 max-w-[64ch] text-fg-muted">{copy.lead}</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p className="font-mono text-[10px] text-fg-muted">run 7f3a2c / read-only / {CURRENT_RESOURCES.length} resources</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !planned;
                setPlanned(next);
                animateTo(next ? 1 : 0);
              }}
              className={`rounded-[1px] border px-3 py-1.5 font-mono text-[11px] font-medium transition-colors ${
                planned
                  ? "border-line text-fg-muted hover:border-fg-muted hover:text-fg"
                  : "border-accent bg-accent text-on-accent hover:bg-accent-lip"
              }`}
            >
              {planned ? copy.reset : copy.plan}
            </button>
            <button
              type="button"
              aria-pressed={infrared}
              onClick={() => setInfrared((value) => !value)}
              className={`rounded-[1px] border px-3 py-1.5 font-mono text-[11px] font-medium transition-colors ${
                infrared ? "border-cluster-ice text-cluster-ice" : "border-line text-fg-muted hover:border-fg-muted hover:text-fg"
              }`}
            >
              {copy.infrared}
            </button>
          </div>
        </div>
      </header>

      <div ref={container} className="relative min-h-[22rem] flex-1 overflow-hidden border-t border-line">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${copy.title} ${copy.lead}`}
          aria-describedby="cluster-graph-summary"
          onPointerMove={onPointer}
          onPointerLeave={onLeave}
          className="absolute inset-0 block size-full"
        />
      </div>

      <div className="border-t border-line">
        <ProjectDeltaStrip nearest={readout} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3">
          {!infrared && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {Object.values(PROVIDERS).map((provider) => (
                <li key={provider.label} className="flex items-center gap-1.5 font-mono text-[10px] text-fg-muted">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: provider.color }} />
                  {provider.label}
                </li>
              ))}
            </ul>
          )}
          <div className="flex min-w-[16rem] flex-1 items-center gap-2">
            <span className="whitespace-nowrap font-mono text-[10px] text-fg-muted">
              {infrared ? "nodes = waste" : "waste"}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-fg">{Math.round(minWaste * 100)}%</span>
            <span
              aria-hidden="true"
              className="h-1.5 min-w-16 flex-1 border border-line bg-[linear-gradient(90deg,#2b1b5a,#7a1f7a,#c2255c,#ef3b24,#f5922b,#ffd36b,#fff4d6)]"
            />
            <span className="font-mono text-[10px] tabular-nums text-fg">{Math.round(maxWaste * 100)}%</span>
            <span className="font-mono text-[10px] text-fg-muted">high</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-fg-muted">
            <span className="whitespace-nowrap text-fg-muted">node size</span>
            <span aria-hidden="true" className="size-[4px] rounded-full bg-fg/60" />
            <span>0.05k</span>
            <span aria-hidden="true" className="size-[8px] rounded-full bg-fg/60" />
            <span>0.3k</span>
            <span aria-hidden="true" className="size-[13px] rounded-full bg-fg/60" />
            <span>2.5k</span>
          </div>
        </div>
      </div>

      <p id="cluster-graph-summary" className="sr-only">
        {`Current monthly cost: ${PROJECTS.map((project) => `${project.label} ${data.current.totals[project.id].toFixed(1)}k USD`).join("; ")}. Proposed: ${PROJECTS.map((project) => `${project.label} ${data.planned.totals[project.id].toFixed(1)}k USD`).join("; ")}. Current total ${CURRENT_TOTAL.toFixed(1)}k, proposed ${PLANNED_TOTAL.toFixed(1)}k USD per month. ${RESOURCES.filter((resource) => resource.added).length} replicas added, ${RESOURCES.filter((resource) => resource.removed).length} idle resources removed, ${RESOURCES.filter((resource) => resource.moved).length} moved.`}
      </p>
    </div>
  );
}
