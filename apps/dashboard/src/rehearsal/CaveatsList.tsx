import { Card } from "~/rehearsal/parts";

export function CaveatsList({ caveats }: { caveats: readonly string[] }) {
  if (caveats.length === 0) return null;
  return (
    <Card id="caveats" title="Measurement notes and caveats">
      <ul className="flex flex-col gap-2">
        {caveats.map((caveat) => (
          <li key={caveat} className="text-label text-fg-muted">
            {caveat}
          </li>
        ))}
      </ul>
    </Card>
  );
}
