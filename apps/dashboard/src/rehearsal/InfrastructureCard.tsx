import type { InfrastructureView } from "~/rehearsal/model";
import { Card, Field } from "~/rehearsal/parts";
import { StatusBadge } from "~/ui/StatusBadge";

export function InfrastructureCard({
  infrastructure,
}: {
  infrastructure: InfrastructureView | null;
}) {
  if (!infrastructure) return null;
  return (
    <Card
      id="infrastructure"
      title="Infrastructure and teardown"
      aside={
        infrastructure.teardownLabel ? (
          <StatusBadge label={infrastructure.teardownLabel} tone={infrastructure.teardownTone} />
        ) : null
      }
    >
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {infrastructure.vpcId ? (
          <Field label="VPC">
            <span className="font-mono">{infrastructure.vpcId}</span>
          </Field>
        ) : null}
        {infrastructure.namePrefix ? (
          <Field label="Name prefix">
            <span className="font-mono">{infrastructure.namePrefix}</span>
          </Field>
        ) : null}
        {infrastructure.endpoint ? (
          <Field label="Endpoint">
            <span className="break-all font-mono">{infrastructure.endpoint}</span>
          </Field>
        ) : null}
        {infrastructure.readiness ? (
          <Field label="Readiness">{infrastructure.readiness}</Field>
        ) : null}
        <Field label="Components created">{infrastructure.componentsCreated.length}</Field>
      </dl>

      {infrastructure.componentsCreated.length > 0 ? (
        <ul aria-label="Components created" className="flex flex-wrap gap-2">
          {infrastructure.componentsCreated.map((component) => (
            <li
              key={component}
              className="rounded-pill border border-border px-2.5 py-0.5 font-mono text-caption"
            >
              {component}
            </li>
          ))}
        </ul>
      ) : null}

      {infrastructure.remaining.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-caption uppercase tracking-wide text-fg-subtle">
            Remaining resources
          </h4>
          <ul className="flex flex-wrap gap-2">
            {infrastructure.remaining.map((resource) => (
              <li key={resource} className="font-mono text-caption">
                {resource}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
