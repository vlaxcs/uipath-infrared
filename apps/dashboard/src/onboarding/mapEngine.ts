import type { Point, SearchArea } from "~/onboarding/types";

export type MapGestures = {
  click(point: Point): void;
  move(index: number, point: Point): void;
  resize(index: number, metres: number): void;
};

export type AreaMapView = {
  show(areas: SearchArea[]): void;
  destroy(): void;
};

export type MapEngine = (element: HTMLElement, start: Point, gestures: MapGestures) => AreaMapView;

export const loadLeaflet = (): Promise<MapEngine> => import("~/onboarding/leafletMap").then((module) => module.leafletEngine);
