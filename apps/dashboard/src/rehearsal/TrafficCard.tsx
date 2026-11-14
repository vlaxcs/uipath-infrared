import type { TrafficView } from "~/rehearsal/model";
import { Card, Field } from "~/rehearsal/parts";

export function TrafficCard({ traffic }: { traffic: TrafficView }) {
  return (
    <Card id="traffic" title="Traffic profile">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Pattern">
          {traffic.pattern}{" "}
          <span className="text-caption text-fg-subtle">({traffic.patternKey})</span>
        </Field>
        <Field label="Duration">{traffic.duration}</Field>
        <Field label="Rate">{traffic.rate}</Field>
        <Field label="Total requests">{traffic.totalRequests}</Field>
      </dl>

      <div className="flex flex-col gap-1">
        <h4 className="text-caption uppercase tracking-wide text-fg-subtle">Endpoints</h4>
        {traffic.endpoints.length === 0 ? (
          <p className="text-label text-fg-subtle">Not stated</p>
        ) : traffic.endpoints.length === 1 ? (
          <p className="break-all font-mono text-label">{traffic.endpoints[0]}</p>
        ) : (
          <ul aria-label="Traffic endpoints" className="flex flex-col gap-1">
            {traffic.endpoints.map((endpoint) => (
              <li key={endpoint} className="break-all font-mono text-label">
                {endpoint}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
