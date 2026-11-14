import { useEffect, useRef, useState } from "react";
import type { AreaMapView, MapEngine } from "~/onboarding/mapEngine";
import { addArea, moveArea, radiusFromMetres } from "~/onboarding/searchAreas";
import type { SearchArea } from "~/onboarding/types";

const ROMANIA = { lat: 45.94, lng: 24.97 };

type Props = { areas: SearchArea[]; onChange: (areas: SearchArea[]) => void; load: () => Promise<MapEngine> };

export function AreaMap({ areas, onChange, load }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const view = useRef<AreaMapView | null>(null);
  const latest = useRef({ areas, onChange });
  latest.current = { areas, onChange };
  const [engine, setEngine] = useState<MapEngine | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    load().then(
      (loaded) => live && setEngine(() => loaded),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [load]);

  useEffect(() => {
    if (!engine || !element.current) return;
    const changeOrRedraw = (next: SearchArea[]) => {
      const { areas: now, onChange: change } = latest.current;
      if (JSON.stringify(next) === JSON.stringify(now)) view.current?.show(now);
      else change(next);
    };
    const first = latest.current.areas[0];
    const created = engine(element.current, first ?? ROMANIA, {
      click: (point) => changeOrRedraw(addArea(latest.current.areas, point)),
      move: (index, point) => changeOrRedraw(moveArea(latest.current.areas, index, point)),
      resize: (index, metres) => {
        const now = latest.current.areas;
        changeOrRedraw(now.map((area, at) => (at === index ? { ...area, radius_km: radiusFromMetres(metres) } : area)));
      },
    });
    view.current = created;
    created.show(latest.current.areas);
    return () => {
      created.destroy();
      view.current = null;
    };
  }, [engine]);

  useEffect(() => {
    view.current?.show(areas);
  }, [areas]);

  if (failed) {
    return (
      <p role="alert" className="text-caption text-status-failed">
        The map did not load. Set the areas with the fields below.
      </p>
    );
  }
  return (
    <div
      ref={element}
      role="region"
      aria-label="Map of the search areas"
      className="z-0 h-72 w-full overflow-hidden rounded-card border border-border bg-surface-muted"
    />
  );
}
