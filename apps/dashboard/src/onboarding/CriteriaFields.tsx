import { useId } from "react";
import { AVAILABILITY_TARGETS, RANKINGS, REGION_GROUPS, ZONE_COUNTS, rankingOf, withRanking, withRegion } from "~/onboarding/criteria";
import type { Criteria } from "~/onboarding/types";

const FIELD = "flex flex-col gap-1";
const LABEL = "text-label font-medium text-fg";
const SELECT = "rounded-control border border-border bg-surface px-3 py-2 text-label text-fg";
const HINT = "text-caption text-fg-subtle";

export function CriteriaFields({ criteria, onChange }: { criteria: Criteria; onChange: (criteria: Criteria) => void }) {
  const id = useId();
  const ranking = rankingOf(criteria.weights);
  const { cost, risk, effort } = criteria.weights;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className={FIELD}>
        <label htmlFor={`${id}-availability`} className={LABEL}>High availability</label>
        <select
          id={`${id}-availability`}
          value={criteria.min_availability_pct}
          onChange={(event) => onChange({ ...criteria, min_availability_pct: Number(event.target.value) })}
          className={SELECT}
        >
          {AVAILABILITY_TARGETS.map((target) => (
            <option key={target} value={target}>{target}% minimum</option>
          ))}
        </select>
        <label htmlFor={`${id}-zones`} className="sr-only">Zones</label>
        <select
          id={`${id}-zones`}
          value={criteria.min_zones}
          onChange={(event) => onChange({ ...criteria, min_zones: Number(event.target.value) })}
          className={SELECT}
        >
          {ZONE_COUNTS.map((zones) => (
            <option key={zones} value={zones}>{zones === 1 ? "1 zone" : `${zones} zones`} minimum</option>
          ))}
        </select>
        <p className={HINT}>Hard constraint: a candidate below it is infeasible.</p>
      </div>

      <div className={FIELD}>
        <label htmlFor={`${id}-ranking`} className={LABEL}>Cost reduction</label>
        <select
          id={`${id}-ranking`}
          value={ranking}
          onChange={(event) => onChange(withRanking(criteria, event.target.value))}
          className={SELECT}
        >
          {RANKINGS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
          {ranking === "custom" ? <option value="custom">Custom</option> : null}
        </select>
        <p className={HINT}>Ranking weights: cost {cost}, risk {risk}, effort {effort}.</p>
      </div>

      <fieldset className={FIELD}>
        <legend className={LABEL}>Data residency</legend>
        {REGION_GROUPS.map((group) => {
          const allowed = criteria.allowed_regions.includes(group.id);
          const last = allowed && criteria.allowed_regions.length === 1;
          return (
            <label key={group.id} className="flex items-center gap-2 text-label text-fg">
              <input
                type="checkbox"
                name="region"
                checked={allowed}
                disabled={last}
                onChange={(event) => onChange(withRegion(criteria, group.id, event.target.checked))}
                className="accent-accent"
              />
              {group.label}
            </label>
          );
        })}
        <p className={HINT}>Where personal and confidential data may live. At least one region stays allowed.</p>
      </fieldset>

      <div className={FIELD}>
        <span className={LABEL}>Performance</span>
        <p className="text-label text-fg-muted">Not evaluated by the engine yet.</p>
      </div>
    </div>
  );
}
