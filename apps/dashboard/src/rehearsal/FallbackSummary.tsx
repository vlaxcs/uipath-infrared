import type { FallbackView } from "~/rehearsal/fallback";
import { Card } from "~/rehearsal/parts";
import { StatusBadge } from "~/ui/StatusBadge";

export function FallbackSummary({ fallback }: { fallback: FallbackView }) {
  return (
    <Card
      id="fallback"
      title="The fallback"
      aside={
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge label="Derived" tone="neutral" />
          <StatusBadge label={fallback.verdictLabel} tone={fallback.tone} />
        </span>
      }
    >
      <p className="text-body">{fallback.headline}</p>

      {fallback.evidence.length > 0 ? (
        <ul aria-label="Fallback evidence" className="flex flex-col gap-1">
          {fallback.evidence.map((item, index) => (
            <li key={`${index}-${item}`} className="text-label text-fg-muted">
              • {item}
            </li>
          ))}
        </ul>
      ) : null}

      {fallback.caveat ? <p className="text-caption text-fg-subtle">{fallback.caveat}</p> : null}
      <p className="text-caption text-fg-subtle">{fallback.derivedLabel}.</p>
    </Card>
  );
}
