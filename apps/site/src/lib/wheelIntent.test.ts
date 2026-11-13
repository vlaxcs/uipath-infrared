import { describe, expect, it } from "vitest";
import { createWheelIntent } from "./wheelIntent";

function run(events: Array<[number, number]>) {
  const intent = createWheelIntent();
  return events.map(([delta, at]) => intent(delta, at));
}

describe("wheel intent", () => {
  it("moves on the very first event of a mouse notch", () => {
    expect(run([[100, 0]])).toEqual([1]);
    expect(run([[-100, 0]])).toEqual([-1]);
  });

  it("gives one push per notch when notches come a moment apart", () => {
    expect(run([[100, 0], [100, 400], [100, 800]])).toEqual([1, 1, 1]);
  });

  it("does not let a quick burst of notches skip several sections", () => {
    expect(run([[100, 0], [100, 60], [100, 120], [100, 180]])).toEqual([1, 0, 0, 0]);
  });

  it("gives one push for a trackpad swipe and ignores its inertia tail", () => {
    const swipe: Array<[number, number]> = [];
    let at = 0;
    for (const delta of [3, 9, 25, 60, 90, 80, 70, 60, 50, 40, 30, 22, 16, 11, 8, 6]) {
      swipe.push([delta, at]);
      at += 16;
    }
    const pushes = run(swipe).filter(Boolean);
    expect(pushes).toEqual([1]);
  });

  it("starts a new push when a new swipe begins after a pause", () => {
    expect(run([[80, 0], [60, 16], [40, 32], [90, 900]])).toEqual([1, 0, 0, 1]);
  });

  it("reacts at once to a change of direction", () => {
    expect(run([[100, 0], [-100, 50]])).toEqual([1, -1]);
  });

  it("ignores tiny movements and zero", () => {
    expect(run([[2, 0], [0, 10], [3, 20]])).toEqual([0, 0, 0]);
  });
});
