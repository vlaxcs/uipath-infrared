import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AreaMap } from "~/onboarding/AreaMap";
import type { MapEngine, MapGestures } from "~/onboarding/mapEngine";
import type { SearchArea } from "~/onboarding/types";

afterEach(cleanup);

function fakeEngine() {
  const drawn: SearchArea[][] = [];
  let gestures: MapGestures | undefined;
  let destroyed = false;
  const engine: MapEngine = (_element, _start, given) => {
    gestures = given;
    return { show: (areas) => drawn.push(areas), destroy: () => (destroyed = true) };
  };
  return {
    drawn,
    gestures: () => gestures!,
    destroyed: () => destroyed,
    load: () => Promise.resolve(engine),
  };
}

const bucharest: SearchArea = { lat: 44.4268, lng: 26.1025, radius_km: 25 };

async function shown(areas: SearchArea[]) {
  const engine = fakeEngine();
  const onChange = vi.fn();
  const view = render(<AreaMap areas={areas} onChange={onChange} load={engine.load} />);
  await act(async () => {});
  const rerender = (next: SearchArea[]) => view.rerender(<AreaMap areas={next} onChange={onChange} load={engine.load} />);
  return { ...engine, onChange, rerender, unmount: view.unmount };
}

describe("the map of the search areas", () => {
  it("draws the areas it is given", async () => {
    const two = [bucharest, { lat: 46.77, lng: 23.59, radius_km: 40 }];
    const { drawn } = await shown(two);
    expect(screen.getByRole("region", { name: "Map of the search areas" })).toBeTruthy();
    expect(drawn.at(-1)).toEqual(two);
  });

  it("adds an area where the map is clicked, and no fourth one", async () => {
    const { gestures, onChange, rerender } = await shown([bucharest]);
    act(() => gestures().click({ lat: 46.77, lng: 23.59 }));
    expect(onChange).toHaveBeenLastCalledWith([bucharest, { lat: 46.77, lng: 23.59, radius_km: 25 }]);
    onChange.mockClear();
    rerender([bucharest, { ...bucharest, lat: 46 }, { ...bucharest, lat: 47 }]);
    act(() => gestures().click({ lat: 45.75, lng: 21.23 }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves an area dragged by its centre, and resizes it in whole km", async () => {
    const { gestures, onChange } = await shown([bucharest]);
    act(() => gestures().move(0, { lat: 44.5, lng: 26.3 }));
    expect(onChange).toHaveBeenLastCalledWith([{ ...bucharest, lat: 44.5, lng: 26.3 }]);
    act(() => gestures().resize(0, 61_700));
    expect(onChange).toHaveBeenLastCalledWith([{ ...bucharest, radius_km: 62 }]);
  });

  it("redraws a circle dragged past 100 km at 100, without a change", async () => {
    const at100 = [{ ...bucharest, radius_km: 100 }];
    const { gestures, onChange, drawn } = await shown(at100);
    const before = drawn.length;
    act(() => gestures().resize(0, 180_000));
    expect(onChange).not.toHaveBeenCalled();
    expect(drawn.length).toBe(before + 1);
    expect(drawn.at(-1)).toEqual(at100);
  });

  it("follows the fields, and lets the map go when it leaves the page", async () => {
    const { drawn, rerender, unmount, destroyed } = await shown([bucharest, { ...bucharest, lat: 46 }]);
    rerender([{ ...bucharest, radius_km: 80 }]);
    expect(drawn.at(-1)).toEqual([{ ...bucharest, radius_km: 80 }]);
    unmount();
    expect(destroyed()).toBe(true);
  });

  it("says so when the map cannot load", async () => {
    render(<AreaMap areas={[bucharest]} onChange={vi.fn()} load={() => Promise.reject(new Error("blocked"))} />);
    expect((await screen.findByRole("alert")).textContent).toContain("The map did not load");
  });
});
