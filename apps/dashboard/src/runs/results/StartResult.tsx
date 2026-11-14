import { formatEUR } from "~/runs/format";
import { Field, Section, Table } from "~/runs/results/ResultParts";

type Scenario = { probability?: number; note?: string; monthly_multiplier?: Record<string, number> };

export type ForecastArtifact = {
  id?: string;
  description?: string;
  horizon_months?: number;
  currency?: string;
  scenarios?: Record<string, Scenario>;
  events?: { month?: number; description?: string }[];
  hard_constraints?: {
    data_residency?: { allowed_regions?: string[]; applies_to?: string[] };
    budget?: { max_monthly_run_cost_eur?: number; max_one_off_migration_cost_eur?: number };
    min_availability_pct?: number;
    allowed_providers?: string[];
    forbidden_providers?: string[];
  };
  cto_settings?: { ha_level?: string; min_zones?: number; weights?: Record<string, number>; strategies_enabled?: string[] };
};

const list = (values?: string[]) => (values && values.length > 0 ? values.join(", ") : "—");

export function StartResult({ value }: { value: ForecastArtifact }) {
  const hard = value.hard_constraints ?? {};
  const cto = value.cto_settings ?? {};
  const weights = Object.entries(cto.weights ?? {})
    .map(([name, weight]) => `${name} ${Math.round(weight * 100)}%`)
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      {value.description ? <p className="text-body">{value.description}</p> : null}

      <Section title="Hard constraints">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field label="Data stays in">{list(hard.data_residency?.allowed_regions)}</Field>
          <Field label="Max run cost">{hard.budget?.max_monthly_run_cost_eur != null ? `${formatEUR(hard.budget.max_monthly_run_cost_eur)}/mo` : "—"}</Field>
          <Field label="Max migration cost">{formatEUR(hard.budget?.max_one_off_migration_cost_eur)}</Field>
          <Field label="Min availability">{hard.min_availability_pct != null ? `${hard.min_availability_pct}%` : "—"}</Field>
          <Field label="Allowed providers">{list(hard.allowed_providers)}</Field>
          <Field label="Forbidden providers">{list(hard.forbidden_providers)}</Field>
        </dl>
      </Section>

      <Section title="Priorities">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field label="Weights">{weights || "—"}</Field>
          <Field label="High availability">{cto.ha_level ? `${cto.ha_level}${cto.min_zones ? `, ${cto.min_zones} zones` : ""}` : "—"}</Field>
          <Field label="Strategies">{list(cto.strategies_enabled)}</Field>
        </dl>
      </Section>

      <Section title={`Forecast · ${value.horizon_months ?? "?"} months`}>
        <Table
          headers={["Scenario", "Probability", "Growth / month", "Note"]}
          rows={Object.entries(value.scenarios ?? {}).map(([name, scenario]) => [
            name,
            scenario.probability != null ? `${Math.round(scenario.probability * 100)}%` : "—",
            Object.entries(scenario.monthly_multiplier ?? {})
              .map(([what, factor]) => `${what} ×${factor}`)
              .join(", ") || "—",
            scenario.note ?? "—",
          ])}
        />
        {value.events && value.events.length > 0 ? (
          <ul className="flex flex-col gap-1 text-caption text-fg-muted">
            {value.events.map((event) => (
              <li key={`${event.month}-${event.description}`}>
                Month {event.month}: {event.description}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </div>
  );
}
