import type { CandidatePoint, ProjectInsight, StepVisit } from "~/insights/types";
import type { RunStep } from "~/runs/types";

export type Frame = "wide" | "tall";

export type Box = { x: number; y: number; w: number; h: number };

export type Stage = {
  width: number;
  height: number;
  river: Box;
  field: Box;
};

export type OrbPlace = { x: number; y: number; r: number; inner: number; docked: boolean };

export const STEPS: readonly RunStep[] = ["extract", "investigate", "propose", "evaluate", "present", "rehearse"];

export const STAGES: Record<Frame, Stage> = {
  wide: {
    width: 1200,
    height: 560,
    river: { x: 430, y: 0, w: 720, h: 300 },
    field: { x: 480, y: 350, w: 650, h: 150 },
  },
  tall: {
    width: 600,
    height: 1080,
    river: { x: 40, y: 330, w: 530, h: 360 },
    field: { x: 70, y: 760, w: 490, h: 250 },
  },
};

const ORB_MIN = 30;
const ORB_MAX = 92;

export function orbRadius(monthly: number | null, largest: number, min = ORB_MIN, max = ORB_MAX): number {
  if (monthly === null || largest <= 0) return min;
  return min + (max - min) * Math.sqrt(Math.min(monthly, largest) / largest);
}

// Area tracks spend: the inner disc is the cost after, scaled against the orb's own cost before.
export function innerRadius(outer: number, before: number | null, after: number | null): number {
  if (before === null || after === null || before <= 0) return 0;
  return outer * Math.sqrt(after / before);
}

export function placeOrbs(projects: readonly ProjectInsight[], frame: Frame, focus: string | null): Record<string, OrbPlace> {
  const stage = STAGES[frame];
  const largest = Math.max(0, ...projects.map((project) => project.before ?? 0));
  const places: Record<string, OrbPlace> = {};
  const count = projects.length;

  projects.forEach((project, index) => {
    if (focus === null) {
      const r = orbRadius(project.before, largest);
      const spot = frame === "wide" ? wideSpot(index, count, stage) : tallSpot(index, count, stage);
      places[project.id] = { ...spot, r, inner: innerRadius(r, project.before, project.after), docked: false };
      return;
    }
    if (project.id === focus) {
      const r = frame === "wide" ? 118 : 96;
      const spot = frame === "wide" ? { x: 215, y: 300 } : { x: 300, y: 175 };
      places[project.id] = { ...spot, r, inner: innerRadius(r, project.before, project.after), docked: false };
      return;
    }
    const others = projects.filter((item) => item.id !== focus);
    const slot = others.findIndex((item) => item.id === project.id);
    const r = 15;
    const spot = frame === "wide" ? { x: 50 + slot * 46, y: 52 } : { x: 40 + slot * 44, y: 40 };
    places[project.id] = { ...spot, r, inner: innerRadius(r, project.before, project.after), docked: true };
  });

  return places;
}

function wideSpot(index: number, count: number, stage: Stage): { x: number; y: number } {
  const gap = stage.width / (count + 1);
  return { x: gap * (index + 1), y: stage.height / 2 + (index % 2 === 0 ? -36 : 30) };
}

function tallSpot(index: number, count: number, stage: Stage): { x: number; y: number } {
  const rows = Math.ceil(count / 2);
  const column = index % 2;
  const row = Math.floor(index / 2);
  const gap = (stage.height - 140) / Math.max(rows, 1);
  return { x: column === 0 ? 170 : 430, y: 140 + gap * (row + 0.5) + (column === 0 ? -30 : 30) };
}

export function orbitSpot(index: number, count: number, radius: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(count, 1);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function stepX(step: RunStep, box: Box): number {
  const index = STEPS.indexOf(step);
  return box.x + 40 + ((box.w - 140) * index) / (STEPS.length - 1);
}

export function laneY(index: number, count: number, box: Box): number {
  const top = box.y + 64;
  const room = box.h - 84;
  const gap = Math.min(78, room / Math.max(count, 1));
  return top + gap * index + gap / 2;
}

// One path through the step columns, with an arc over the lane each time a revision goes back.
export function lanePath(visits: readonly StepVisit[], y: number, box: Box): string {
  const points = visits.map((visit) => stepX(visit.step, box));
  if (points.length === 0) return "";
  let path = `M ${box.x} ${y} L ${points[0]} ${y}`;
  let loops = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    if (to >= from) {
      path += ` L ${to} ${y}`;
    } else {
      loops += 1;
      const lift = 14 + loops * 10 + (from - to) * 0.06;
      path += ` C ${from + 18} ${y - lift}, ${to - 18} ${y - lift}, ${to} ${y}`;
    }
  }
  return path;
}

export type Scale = { min: number; max: number };

export function fieldScales(points: readonly CandidatePoint[], baseline: { monthly: number | null; availability: number | null }) {
  const costs = [baseline.monthly, ...points.map((point) => point.monthly)].filter((value): value is number => value !== null);
  const availability = [baseline.availability, ...points.map((point) => point.availability)].filter(
    (value): value is number => value !== null,
  );
  return { cost: padded(costs, 0.08), availability: padded(availability, 0.12) };
}

function padded(values: readonly number[], share: number): Scale {
  if (values.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || Math.abs(max) || 1) * share;
  return { min: min - pad, max: max + pad };
}

export function project(value: number, scale: Scale, from: number, to: number): number {
  return from + ((value - scale.min) / (scale.max - scale.min || 1)) * (to - from);
}
