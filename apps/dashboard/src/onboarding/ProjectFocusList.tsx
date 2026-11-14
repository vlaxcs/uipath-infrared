import { useId } from "react";
import { FOCUSES, MARKETS, withFocus } from "~/onboarding/criteria";
import type { Application, Criteria, Focus } from "~/onboarding/types";

const INPUT = "w-full min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-label text-fg";
const DEFAULT = "default";

type ProjectFocusListProps = {
  applications: readonly Application[];
  focus: Readonly<Record<string, Criteria>>;
  onChange: (focus: Record<string, Criteria>) => void;
};

export function ProjectFocusList({ applications, focus, onChange }: ProjectFocusListProps) {
  const id = useId();
  if (applications.length === 0) return <p className="text-label text-fg-muted">No estate lists its projects yet.</p>;
  const set = (appId: string, criteria: Criteria | null) => {
    const next = { ...focus };
    if (criteria) next[appId] = criteria;
    else delete next[appId];
    onChange(next);
  };
  return (
    <ul aria-label="Each project's focus" className="flex flex-col gap-3">
      {applications.map((app) => {
        const own = focus[app.id];
        return (
          <li key={app.id} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,12rem)]">
            <div className="flex min-w-0 flex-col">
              <span className="text-label font-semibold text-fg">{app.name}</span>
              <span className="font-mono text-caption text-fg-subtle">{app.stacks.join(", ")}</span>
            </div>
            <label htmlFor={`${id}-${app.id}`} className="flex min-w-0 flex-col gap-1 text-caption text-fg-muted">
              Focus
              <select
                id={`${id}-${app.id}`}
                value={own?.focus ?? DEFAULT}
                onChange={(event) => set(app.id, event.target.value === DEFAULT ? null : withFocus(event.target.value as Focus, own?.market))}
                className={INPUT}
              >
                <option value={DEFAULT}>Use the default</option>
                {FOCUSES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            {own?.focus === "zone" ? (
              <label htmlFor={`${id}-${app.id}-market`} className="flex min-w-0 flex-col gap-1 text-caption text-fg-muted">
                Market
                <select id={`${id}-${app.id}-market`} value={own.market} onChange={(event) => set(app.id, { focus: "zone", market: event.target.value })} className={INPUT}>
                  {MARKETS.map((market) => (
                    <option key={market.code} value={market.code}>{market.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <span aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
