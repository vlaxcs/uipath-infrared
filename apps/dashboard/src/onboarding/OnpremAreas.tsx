import { AreaMap } from "~/onboarding/AreaMap";
import { AREA_SWATCH } from "~/onboarding/areaColours";
import { loadLeaflet, type MapEngine } from "~/onboarding/mapEngine";
import { MAX_SEARCH_AREAS, withoutArea } from "~/onboarding/searchAreas";
import type { SearchArea } from "~/onboarding/types";

const SMALL_BUTTON = "rounded-control border border-border-strong bg-surface px-3 py-1 text-label text-fg hover:bg-surface-muted";

type Props = { areas: SearchArea[]; onChange: (areas: SearchArea[]) => void; loadMap?: () => Promise<MapEngine> };

function place(area: SearchArea): string {
  return `${area.lat.toFixed(3)}, ${area.lng.toFixed(3)}`;
}

export function OnpremAreas({ areas, onChange, loadMap = loadLeaflet }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-fg-muted">
        Click the map to pick up to {MAX_SEARCH_AREAS} areas. Infrared looks for a space in any of them and picks the cheapest one that fits. Drag a circle's centre to move it, or the handle on its edge to resize it.
      </p>
      <AreaMap areas={areas} onChange={onChange} load={loadMap} fallback="The map did not load, so no area can be picked. Reload the page to try again." />
      <p className="text-caption text-fg-subtle">Map tiles come from OpenStreetMap, which sees the places you look at.</p>
      {areas.length === 0 ? (
        <p className="text-label text-fg-muted">No area yet. Click the map where a space could be.</p>
      ) : (
        <ul aria-label="Picked areas" className="flex flex-col gap-2">
          {areas.map((area, index) => (
            <li key={index} aria-label={`Area ${index + 1}`} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-3">
              <span className="flex items-center gap-2 text-label text-fg">
                <span aria-hidden="true" data-swatch={index + 1} className={`size-3 rounded-pill ${AREA_SWATCH[index]}`} />
                <span className="font-medium">Area {index + 1}</span>
                <span className="font-mono text-caption text-fg-muted">
                  {place(area)} · {area.radius_km} km
                </span>
              </span>
              <button type="button" onClick={() => onChange(withoutArea(areas, index))} className={SMALL_BUTTON}>
                Remove area {index + 1}
              </button>
            </li>
          ))}
        </ul>
      )}
      <span className="text-caption text-fg-muted">
        {areas.length} of {MAX_SEARCH_AREAS}
      </span>
    </div>
  );
}
