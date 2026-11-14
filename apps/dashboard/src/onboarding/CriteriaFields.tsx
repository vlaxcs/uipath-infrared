import { useId, useState } from "react";
import { FOCUSES, marketsOffered, withFocus } from "~/onboarding/criteria";
import type { Criteria } from "~/onboarding/types";

type CriteriaFieldsProps = {
  criteria: Criteria;
  onChange: (criteria: Criteria) => void;
  markets?: readonly string[];
};

export function CriteriaFields({ criteria, onChange, markets }: CriteriaFieldsProps) {
  const id = useId();
  const [lastMarket, setLastMarket] = useState(criteria.market);
  const offered = marketsOffered(markets);
  const market = offered.find((item) => item.code === criteria.market);

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Focus" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FOCUSES.map((focus) => {
          const chosen = criteria.focus === focus.id;
          return (
            <label
              key={focus.id}
              className={
                chosen
                  ? "flex cursor-pointer flex-col gap-1 rounded-card border-2 border-accent bg-surface p-4"
                  : "flex cursor-pointer flex-col gap-1 rounded-card border-2 border-border bg-surface p-4 hover:border-border-strong"
              }
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${id}-focus`}
                  value={focus.id}
                  checked={chosen}
                  onChange={() => onChange(withFocus(focus.id, lastMarket))}
                  className="accent-accent"
                />
                <span className="text-label font-semibold text-fg">{focus.label}</span>
              </span>
              <span className="text-caption text-fg-subtle">{focus.effect}</span>
            </label>
          );
        })}
      </div>

      {criteria.focus === "zone" ? (
        <div className="flex flex-col gap-1 sm:max-w-sm">
          <label htmlFor={`${id}-market`} className="text-label font-medium text-fg">Market</label>
          <select
            id={`${id}-market`}
            value={criteria.market}
            onChange={(event) => {
              setLastMarket(event.target.value);
              onChange({ focus: "zone", market: event.target.value });
            }}
            className="rounded-control border border-border bg-surface px-3 py-2 text-label text-fg"
          >
            {offered.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
          {market ? (
            <p className="text-caption text-fg-subtle">
              Allowed regions: <span className="font-mono">{market.regions}</span>. The catalog prices regions per group, so a country narrows to its group.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
