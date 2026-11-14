import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { MapEngine, MapGestures } from "~/onboarding/mapEngine";
import { OnpremAreas } from "~/onboarding/OnpremAreas";
import type { SearchArea } from "~/onboarding/types";

afterEach(cleanup);

function Harness({ load }: { load: () => Promise<MapEngine> }) {
  const [areas, setAreas] = useState<SearchArea[]>([]);
  return <OnpremAreas areas={areas} onChange={setAreas} loadMap={load} />;
}

async function shown() {
  let gestures: MapGestures | undefined;
  const engine: MapEngine = (_element, _start, given) => {
    gestures = given;
    return { show: () => undefined, destroy: () => undefined };
  };
  render(<Harness load={() => Promise.resolve(engine)} />);
  await act(async () => {});
  return (lat: number, lng: number) => act(() => gestures!.click({ lat, lng }));
}

describe("the on-prem areas", () => {
  it("are picked only on the map, with no field to type a place in", async () => {
    const click = await shown();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryByRole("radio", { name: /headquarters/i })).toBeNull();
    expect(screen.getByText(/No area yet/)).toBeTruthy();
    click(44.43, 26.1);
    expect(within(screen.getByRole("listitem", { name: "Area 1" })).getByText("44.430, 26.100 · 25 km")).toBeTruthy();
  });

  it("stop at three, each in its own colour, and remove any of them", async () => {
    const click = await shown();
    click(44.43, 26.1);
    click(46.77, 23.59);
    click(45.75, 21.23);
    click(47.16, 27.58);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(screen.getByText("3 of 3")).toBeTruthy();
    const swatches = items.map((item) => item.querySelector("[data-swatch]")!.className);
    expect(new Set(swatches).size).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Remove area 1" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(within(screen.getByRole("listitem", { name: "Area 1" })).getByText(/46.770/)).toBeTruthy();
  });
});
