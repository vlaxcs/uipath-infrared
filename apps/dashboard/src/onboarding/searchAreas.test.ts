import { describe, expect, it } from "vitest";
import { addArea, areaBeside, MAX_SEARCH_AREAS, moveArea, radiusFromMetres, removeArea } from "~/onboarding/searchAreas";

const bucharest = { lat: 44.4268, lng: 26.1025, radius_km: 25 };

describe("the search areas of an on-prem site", () => {
  it("adds an area of 25 km at the point, up to three", () => {
    const two = addArea([bucharest], { lat: 46.770439, lng: 23.591423 });
    expect(two[1]).toEqual({ lat: 46.77044, lng: 23.59142, radius_km: 25 });
    const three = addArea(two, { lat: 45.75, lng: 21.23 });
    expect(three).toHaveLength(MAX_SEARCH_AREAS);
    expect(addArea(three, { lat: 47.16, lng: 27.59 })).toBe(three);
  });

  it("never removes the last area", () => {
    const two = addArea([bucharest], { lat: 46.77, lng: 23.59 });
    expect(removeArea(two, 0)).toEqual([two[1]]);
    expect(removeArea([bucharest], 0)).toEqual([bucharest]);
  });

  it("moves one area and keeps its radius and name", () => {
    const named = { ...bucharest, label: "Bucharest" };
    expect(moveArea([named], 0, { lat: 44.5, lng: 26.2 })).toEqual([{ label: "Bucharest", lat: 44.5, lng: 26.2, radius_km: 25 }]);
  });

  it("reads a dragged radius in whole km from 5 to 100", () => {
    expect(radiusFromMetres(41_400)).toBe(41);
    expect(radiusFromMetres(1_200)).toBe(5);
    expect(radiusFromMetres(250_000)).toBe(100);
  });

  it("puts a new area beside the last one, so the circles do not cover each other", () => {
    const beside = areaBeside(bucharest);
    expect(beside.lat).toBe(bucharest.lat);
    expect(beside.lng).toBeGreaterThan(26.7);
    expect(beside.lng).toBeLessThan(26.8);
    expect(areaBeside({ lat: 0, lng: 179.9, radius_km: 25 }).lng).toBeLessThan(-179);
  });
});
