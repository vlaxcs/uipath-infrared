import { AreaMap } from "~/onboarding/AreaMap";
import { AREA_SWATCH } from "~/onboarding/areaColours";
import { loadLeaflet, type MapEngine } from "~/onboarding/mapEngine";
import { addArea, areaBeside, DEFAULT_RADIUS_KM, MAX_RADIUS_KM, MAX_SEARCH_AREAS, MIN_RADIUS_KM, removeArea } from "~/onboarding/searchAreas";
import type { HeadquartersSite, ProfileSite, SearchArea, SearchSite } from "~/onboarding/types";

const INPUT = "rounded-control border border-border bg-surface px-3 py-2 text-label text-fg";
const SMALL_BUTTON = "rounded-control border border-border-strong bg-surface px-3 py-1 text-label text-fg hover:bg-surface-muted disabled:opacity-50 disabled:hover:bg-surface";

export const NEW_SITE: ProfileSite = { kind: "search", areas: [{ lat: 44.4268, lng: 26.1025, radius_km: DEFAULT_RADIUS_KM }] };

function number(value: string): number {
  return value === "" ? NaN : Number(value);
}

function asHeadquarters(site: SearchSite): HeadquartersSite {
  const first = site.areas[0];
  return { kind: "headquarters", label: first?.label ?? "", lat: first?.lat ?? 44.4268, lng: first?.lng ?? 26.1025, free_area_m2: 100 };
}

function asSearch(site: HeadquartersSite): SearchSite {
  const label = site.label.trim() === "" ? {} : { label: site.label };
  return { kind: "search", areas: [{ ...label, lat: site.lat, lng: site.lng, radius_km: DEFAULT_RADIUS_KM }] };
}

type LoadMap = (() => Promise<MapEngine>) | null;

type Props = { id: string; site: ProfileSite; onChange: (site: ProfileSite) => void; loadMap?: LoadMap };

export function SiteFields({ id, site, onChange, loadMap = loadLeaflet }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1">
        <legend className="text-label font-medium text-fg">Site</legend>
        {(["search", "headquarters"] as const).map((kind) => (
          <label key={kind} className="flex items-center gap-2 text-label text-fg">
            <input
              type="radio"
              name={`${id}-kind`}
              checked={site.kind === kind}
              onChange={() => {
                if (site.kind === kind) return;
                onChange(site.kind === "search" ? asHeadquarters(site) : asSearch(site));
              }}
              className="accent-accent"
            />
            {kind === "search" ? "Find a space near" : "At our headquarters"}
          </label>
        ))}
      </fieldset>
      {site.kind === "search" ? (
        <SearchFields id={id} site={site} onChange={onChange} loadMap={loadMap} />
      ) : (
        <HeadquartersFields site={site} onChange={onChange} />
      )}
    </div>
  );
}

function HeadquartersFields({ site, onChange }: { site: HeadquartersSite; onChange: (site: ProfileSite) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-label text-fg md:col-span-2">
        Address
        <input required value={site.label} onChange={(event) => onChange({ ...site, label: event.target.value })} className={INPUT} />
      </label>
      <PointFields point={site} onChange={(point) => onChange({ ...site, ...point })} />
      <label className="flex flex-col gap-1 text-label text-fg">
        Free floor area, m²
        <input required type="number" min={1} value={Number.isNaN(site.free_area_m2) ? "" : site.free_area_m2} onChange={(event) => onChange({ ...site, free_area_m2: number(event.target.value) })} className={INPUT} />
      </label>
    </div>
  );
}

function SearchFields({ id, site, onChange, loadMap }: { id: string; site: SearchSite; onChange: (site: ProfileSite) => void; loadMap: LoadMap }) {
  const areas = site.areas;
  const change = (next: SearchArea[]) => onChange({ ...site, areas: next });
  const full = areas.length >= MAX_SEARCH_AREAS;
  const last = areas[areas.length - 1];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-fg-muted">
        Up to {MAX_SEARCH_AREAS} areas. Infrared looks for a space in any of them and picks the cheapest one that fits.
      </p>
      {loadMap ? (
        <div className="flex flex-col gap-1">
          <AreaMap areas={areas} onChange={change} load={loadMap} />
          <p className="text-caption text-fg-muted">
            Click the map to add an area, drag a circle's centre to move it, drag the handle on its edge to resize it. Map tiles come from OpenStreetMap, which sees the places you look at.
          </p>
        </div>
      ) : null}
      {areas.map((area, index) => (
        <fieldset key={index} className="grid gap-3 rounded-card border border-border p-3 md:grid-cols-3">
          <legend className="flex items-center gap-2 px-1 text-label font-medium text-fg">
            <span aria-hidden="true" className={`size-3 rounded-pill ${AREA_SWATCH[index]}`} />
            Area {index + 1}
          </legend>
          <label className="flex flex-col gap-1 text-label text-fg md:col-span-3">
            Name, optional
            <input
              id={`${id}-area-${index}-label`}
              value={area.label ?? ""}
              onChange={(event) => {
                const { label: _dropped, ...rest } = area;
                change(areas.map((kept, at) => (at === index ? (event.target.value === "" ? rest : { ...rest, label: event.target.value }) : kept)));
              }}
              className={INPUT}
            />
          </label>
          <PointFields point={area} onChange={(point) => change(areas.map((kept, at) => (at === index ? { ...kept, ...point } : kept)))} />
          <label className="flex flex-col gap-1 text-label text-fg">
            Radius, km ({MIN_RADIUS_KM} to {MAX_RADIUS_KM})
            <input
              required
              type="number"
              min={MIN_RADIUS_KM}
              max={MAX_RADIUS_KM}
              value={Number.isNaN(area.radius_km) ? "" : area.radius_km}
              onChange={(event) => change(areas.map((kept, at) => (at === index ? { ...kept, radius_km: number(event.target.value) } : kept)))}
              className={INPUT}
            />
          </label>
          <div className="md:col-span-3">
            <button type="button" disabled={areas.length <= 1} onClick={() => change(removeArea(areas, index))} className={SMALL_BUTTON}>
              Remove area {index + 1}
            </button>
          </div>
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" disabled={full || !last} onClick={() => last && change(addArea(areas, areaBeside(last)))} className={SMALL_BUTTON}>
          Add an area
        </button>
        <span className="text-caption text-fg-muted">
          {areas.length} of {MAX_SEARCH_AREAS}
        </span>
      </div>
    </div>
  );
}

function PointFields({ point, onChange }: { point: { lat: number; lng: number }; onChange: (point: { lat: number; lng: number }) => void }) {
  return (
    <>
      <label className="flex flex-col gap-1 text-label text-fg">
        Latitude
        <input required type="number" step="any" min={-90} max={90} value={Number.isNaN(point.lat) ? "" : point.lat} onChange={(event) => onChange({ ...point, lat: number(event.target.value) })} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-label text-fg">
        Longitude
        <input required type="number" step="any" min={-180} max={180} value={Number.isNaN(point.lng) ? "" : point.lng} onChange={(event) => onChange({ ...point, lng: number(event.target.value) })} className={INPUT} />
      </label>
    </>
  );
}
