import type { ExtrasView } from "~/rehearsal/model";
import { Card } from "~/rehearsal/parts";

export function RehearsalExtras({ extras }: { extras: ExtrasView }) {
  if (
    extras.built.length === 0 &&
    extras.skipped.length === 0 &&
    extras.notBuilt.length === 0
  ) {
    return null;
  }

  return (
    <Card id="extras" title="Rehearsal extras">
      {extras.built.length > 0 ? (
        <details className="rounded-control border border-border p-3">
          <summary className="cursor-pointer text-label font-medium">
            Built resources ({extras.built.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {extras.built.map((component) => (
              <li key={component.id} className="flex flex-col gap-1">
                <p className="text-label">
                  <span className="font-mono">{component.id}</span> · {component.kind}
                  {component.sku ? ` · ${component.sku}` : ""}
                  {component.zones ? ` · ${component.zones} zone(s)` : ""}
                </p>
                {component.detail ? (
                  <p className="text-caption text-fg-muted">{component.detail}</p>
                ) : null}
                {component.resources.length > 0 ? (
                  <ul
                    aria-label={`Resources for ${component.id}`}
                    className="flex flex-col gap-1"
                  >
                    {component.resources.map((resource) => (
                      <li
                        key={resource.id}
                        className="break-all font-mono text-caption text-fg-subtle"
                      >
                        {resource.type} · {resource.name}
                        {resource.zone ? ` · ${resource.zone}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {extras.skipped.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-caption uppercase tracking-wide text-fg-subtle">Actions skipped</h4>
          <ul className="flex flex-col gap-1">
            {extras.skipped.map((action) => (
              <li key={action.id} className="text-label text-fg-muted">
                <span className="font-mono">{action.component}</span> · {action.action}
                {action.target ? ` → ${action.target}` : ""}
                {action.reason ? ` — ${action.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {extras.notBuilt.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-caption uppercase tracking-wide text-fg-subtle">Actions not built</h4>
          <ul className="flex flex-col gap-1">
            {extras.notBuilt.map((action) => (
              <li key={action.id} className="text-label text-fg-muted">
                <span className="font-mono">{action.component}</span> · {action.kind} · {action.action}
                {action.reason ? ` — ${action.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
