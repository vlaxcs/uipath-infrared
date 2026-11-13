import { describe, expect, it } from "vitest";
import { nearestRest, restStops, stepStop } from "./snap";

const screens = [
  { start: 0, end: 1000 },
  { start: 1000, end: 2000 },
  { start: 2000, end: 3000 },
];
const wide = [
  { start: 0, end: 1000 },
  { start: 1000, end: 2500 },
  { start: 2500, end: 3500 },
];

describe("snapping", () => {
  it("never rests between two panels", () => {
    for (let x = 0; x <= 2000; x += 37) {
      for (const direction of [-1, 0, 1]) {
        expect([0, 1000, 2000]).toContain(nearestRest(x, direction, 1000, 2000, screens));
      }
    }
  });

  it("settles on the nearest panel when there was no direction", () => {
    expect(nearestRest(350, 0, 1000, 2000, screens)).toBe(0);
    expect(nearestRest(650, 0, 1000, 2000, screens)).toBe(1000);
  });

  it("moves on to the next panel after any real push, even a single wheel notch", () => {
    expect(nearestRest(100, 1, 1000, 2000, screens)).toBe(1000);
    expect(nearestRest(1100, 1, 1000, 2000, screens)).toBe(2000);
    expect(nearestRest(900, -1, 1000, 2000, screens)).toBe(0);
    expect(nearestRest(1900, -1, 1000, 2000, screens)).toBe(1000);
  });

  it("lets a panel wider than the screen rest anywhere inside it", () => {
    expect(nearestRest(1200, 0, 1000, 2500, wide)).toBe(1200);
    expect(nearestRest(1200, 1, 1000, 2500, wide)).toBe(1200);
    expect(nearestRest(1300, -1, 1000, 2500, wide)).toBe(1300);
  });

  it("leaves a wide panel from its edge, and snaps to the edge when the push ends past it", () => {
    expect(nearestRest(1500, 1, 1000, 2500, wide)).toBe(2500);
    expect(nearestRest(1500, 0, 1000, 2500, wide)).toBe(1500);
    expect(nearestRest(1800, 0, 1000, 2500, wide)).toBe(1500);
    expect(nearestRest(2200, 0, 1000, 2500, wide)).toBe(2500);
  });

  it("does not treat a scrollbar-wide overflow as a wide panel", () => {
    const withScrollbar = [
      { start: 0, end: 1015 },
      { start: 1015, end: 2030 },
    ];
    expect(nearestRest(15, 0, 1000, 1015, withScrollbar)).toBe(0);
    expect(nearestRest(1000, 0, 1000, 1015, withScrollbar)).toBe(1015);
  });

  it("keeps a rest position where it is, and stays at the ends", () => {
    expect(nearestRest(1000, 0, 1000, 2000, screens)).toBe(1000);
    expect(nearestRest(2000, 1, 1000, 2000, screens)).toBe(2000);
    expect(nearestRest(0, -1, 1000, 2000, screens)).toBe(0);
  });
});

describe("stops", () => {
  it("has one stop per panel that fits the screen", () => {
    expect(restStops(1000, 2000, screens)).toEqual([0, 1000, 2000]);
  });

  it("has two stops for a panel wider than the screen", () => {
    expect(restStops(1000, 2500, wide)).toEqual([0, 1000, 1500, 2500]);
  });

  it("steps exactly one stop, whatever the distance travelled", () => {
    const stops = [0, 1000, 2000];
    expect(stepStop(stops, 0, 1)).toBe(1000);
    expect(stepStop(stops, 1000, 1)).toBe(2000);
    expect(stepStop(stops, 1000, -1)).toBe(0);
    expect(stepStop(stops, 1180, 1)).toBe(2000);
    expect(stepStop(stops, 2000, 1)).toBe(2000);
    expect(stepStop(stops, 0, -1)).toBe(0);
    expect(stepStop(stops, 640, 0)).toBe(1000);
  });
});
