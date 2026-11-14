import type { ProfileSite } from "~/onboarding/types";

const INPUT = "rounded-control border border-border bg-surface px-3 py-2 text-label text-fg";

export const NEW_SITE: ProfileSite = { kind: "search", label: "", lat: 44.4268, lng: 26.1025, radius_km: 25 };

export function SiteFields({ id, site, onChange }: { id: string; site: ProfileSite; onChange: (site: ProfileSite) => void }) {
  const number = (value: string) => (value === "" ? NaN : Number(value));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <fieldset className="flex flex-col gap-1 md:col-span-2">
        <legend className="text-label font-medium text-fg">Site</legend>
        {(["search", "headquarters"] as const).map((kind) => (
          <label key={kind} className="flex items-center gap-2 text-label text-fg">
            <input
              type="radio"
              name={`${id}-kind`}
              checked={site.kind === kind}
              onChange={() =>
                onChange(kind === "search" ? { ...site, kind, radius_km: site.radius_km ?? 25, free_area_m2: undefined } : { ...site, kind, free_area_m2: site.free_area_m2 ?? 100, radius_km: undefined })
              }
              className="accent-accent"
            />
            {kind === "search" ? "Find a space near" : "At our headquarters"}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-label text-fg md:col-span-2">
        Address
        <input value={site.label} onChange={(event) => onChange({ ...site, label: event.target.value })} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-label text-fg">
        Latitude
        <input type="number" step="any" value={site.lat} onChange={(event) => onChange({ ...site, lat: number(event.target.value) })} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-label text-fg">
        Longitude
        <input type="number" step="any" value={site.lng} onChange={(event) => onChange({ ...site, lng: number(event.target.value) })} className={INPUT} />
      </label>
      {site.kind === "search" ? (
        <label className="flex flex-col gap-1 text-label text-fg">
          Radius, km (5 to 100)
          <input type="number" min={5} max={100} value={site.radius_km ?? ""} onChange={(event) => onChange({ ...site, radius_km: number(event.target.value) })} className={INPUT} />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-label text-fg">
          Free floor area, m²
          <input type="number" min={1} value={site.free_area_m2 ?? ""} onChange={(event) => onChange({ ...site, free_area_m2: number(event.target.value) })} className={INPUT} />
        </label>
      )}
    </div>
  );
}
