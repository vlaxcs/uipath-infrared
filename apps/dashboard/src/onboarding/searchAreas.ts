import type { Point, SearchArea } from "~/onboarding/types";

export const MAX_SEARCH_AREAS = 3;
export const MIN_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 100;
export const DEFAULT_RADIUS_KM = 25;

const KM_PER_DEGREE = 111.32;

function rounded(degrees: number): number {
  return Math.round(degrees * 1e5) / 1e5;
}

function wrappedLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function addArea(areas: SearchArea[], point: Point): SearchArea[] {
  if (areas.length >= MAX_SEARCH_AREAS) return areas;
  return [...areas, { lat: rounded(point.lat), lng: rounded(point.lng), radius_km: DEFAULT_RADIUS_KM }];
}

export function removeArea(areas: SearchArea[], index: number): SearchArea[] {
  return areas.length <= 1 ? areas : areas.filter((_, at) => at !== index);
}

export function moveArea(areas: SearchArea[], index: number, point: Point): SearchArea[] {
  return areas.map((area, at) => (at === index ? { ...area, lat: rounded(point.lat), lng: rounded(point.lng) } : area));
}

export function radiusFromMetres(metres: number): number {
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.round(metres / 1000)));
}

export function areaBeside(area: SearchArea): Point {
  const kmPerDegreeLng = KM_PER_DEGREE * Math.max(Math.cos((area.lat * Math.PI) / 180), 0.01);
  return { lat: area.lat, lng: rounded(wrappedLng(area.lng + (2 * area.radius_km) / kmPerDegreeLng)) };
}
