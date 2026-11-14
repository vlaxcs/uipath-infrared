import { regionLabel } from "~/domain/cloud-rules";

export function RegionChips({ regions }: { regions: string[] }) {
  return (
    <ul aria-label="Regions" className="flex flex-wrap gap-1.5">
      {regions.map((region) => (
        <li key={region} title={regionLabel(region)} className="type-code rounded-full border border-line bg-sunken px-2.5 py-0.5 text-fg">
          {region}
        </li>
      ))}
    </ul>
  );
}
