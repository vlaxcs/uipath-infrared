import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NEW_SITE, SiteFields } from "~/onboarding/SiteFields";
import type { ProfileSite } from "~/onboarding/types";

afterEach(cleanup);

function Harness({ initial, onChange }: { initial: ProfileSite; onChange: (site: ProfileSite) => void }) {
  const [site, setSite] = useState(initial);
  return (
    <SiteFields
      id="test-site"
      site={site}
      loadMap={null}
      onChange={(next) => {
        setSite(next);
        onChange(next);
      }}
    />
  );
}

function area(index: number) {
  return within(screen.getByRole("group", { name: `Area ${index}` }));
}

describe("the on-prem site fields", () => {
  it("add areas with the keyboard alone, up to three", () => {
    const onChange = vi.fn();
    render(<Harness initial={NEW_SITE} onChange={onChange} />);
    const add = screen.getByRole("button", { name: "Add an area" });
    fireEvent.click(add);
    fireEvent.click(add);
    expect(screen.getAllByRole("group", { name: /^Area \d$/ })).toHaveLength(3);
    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("3 of 3")).toBeTruthy();
    const areas = (onChange.mock.lastCall![0] as Extract<ProfileSite, { kind: "search" }>).areas;
    expect(areas).toHaveLength(3);
    expect(new Set(areas.map((kept) => kept.lng)).size).toBe(3);
  });

  it("set each area's name, point and radius on its own", () => {
    const onChange = vi.fn();
    render(<Harness initial={NEW_SITE} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add an area" }));
    fireEvent.change(area(2).getByLabelText("Name, optional"), { target: { value: "Cluj" } });
    fireEvent.change(area(2).getByLabelText("Latitude"), { target: { value: "46.77" } });
    fireEvent.change(area(2).getByLabelText("Longitude"), { target: { value: "23.59" } });
    fireEvent.change(area(2).getByLabelText("Radius, km (5 to 100)"), { target: { value: "40" } });
    expect(onChange.mock.lastCall![0]).toEqual({
      kind: "search",
      areas: [NEW_SITE.kind === "search" ? NEW_SITE.areas[0] : null, { label: "Cluj", lat: 46.77, lng: 23.59, radius_km: 40 }],
    });
  });

  it("drop an empty name instead of saving an empty one", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ kind: "search", areas: [{ label: "Bucharest", lat: 44.43, lng: 26.1, radius_km: 25 }] }} onChange={onChange} />);
    fireEvent.change(area(1).getByLabelText("Name, optional"), { target: { value: "" } });
    expect(onChange.mock.lastCall![0]).toEqual({ kind: "search", areas: [{ lat: 44.43, lng: 26.1, radius_km: 25 }] });
  });

  it("remove any area but the last one", () => {
    const onChange = vi.fn();
    render(<Harness initial={NEW_SITE} onChange={onChange} />);
    expect((area(1).getByRole("button", { name: "Remove area 1" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Add an area" }));
    fireEvent.click(area(1).getByRole("button", { name: "Remove area 1" }));
    expect(screen.getAllByRole("group", { name: /^Area \d$/ })).toHaveLength(1);
    expect((onChange.mock.lastCall![0] as Extract<ProfileSite, { kind: "search" }>).areas[0].lng).toBeGreaterThan(26.7);
  });

  it("turn a search into a headquarters at the first area, and back", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ kind: "search", areas: [{ label: "Cluj", lat: 46.77, lng: 23.59, radius_km: 40 }] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "At our headquarters" }));
    expect(onChange.mock.lastCall![0]).toEqual({ kind: "headquarters", label: "Cluj", lat: 46.77, lng: 23.59, free_area_m2: 100 });
    expect(screen.queryByRole("button", { name: "Add an area" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Find a space near" }));
    expect(onChange.mock.lastCall![0]).toEqual({ kind: "search", areas: [{ label: "Cluj", lat: 46.77, lng: 23.59, radius_km: 25 }] });
  });

  it("complete the site with the fields alone, without the map", () => {
    render(<Harness initial={NEW_SITE} onChange={vi.fn()} />);
    expect(screen.queryByRole("region", { name: "Map of the search areas" })).toBeNull();
    expect(area(1).getByLabelText("Latitude")).toBeTruthy();
  });
});
