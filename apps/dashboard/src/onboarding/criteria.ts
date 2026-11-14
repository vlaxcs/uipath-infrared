import type { Criteria, Profile, Weights } from "~/onboarding/types";

export const AVAILABILITY_TARGETS = [99.5, 99.9, 99.95, 99.99] as const;
export const ZONE_COUNTS = [1, 2, 3] as const;

export const RANKINGS: readonly { id: string; label: string; weights: Weights }[] = [
  { id: "cost", label: "Cost first", weights: { cost: 0.65, risk: 0.25, effort: 0.1 } },
  { id: "balanced", label: "Balanced", weights: { cost: 0.4, risk: 0.4, effort: 0.2 } },
  { id: "risk", label: "Risk first", weights: { cost: 0.2, risk: 0.65, effort: 0.15 } },
];

export const REGION_GROUPS: readonly { id: string; label: string }[] = [
  { id: "eu-*", label: "EU (eu-*)" },
  { id: "us-*", label: "US (us-*)" },
];

export const DEFAULT_CRITERIA: Criteria = {
  min_availability_pct: 99.9,
  min_zones: 2,
  weights: RANKINGS[0].weights,
  allowed_regions: ["eu-*"],
};

export const DEFAULT_PROFILE: Profile = { criteria: DEFAULT_CRITERIA, onprem: { wanted: false } };

export function rankingOf(weights: Weights): string {
  const match = RANKINGS.find(
    (ranking) => ranking.weights.cost === weights.cost && ranking.weights.risk === weights.risk && ranking.weights.effort === weights.effort,
  );
  return match?.id ?? "custom";
}

export function withRanking(criteria: Criteria, id: string): Criteria {
  const ranking = RANKINGS.find((candidate) => candidate.id === id);
  return ranking ? { ...criteria, weights: ranking.weights } : criteria;
}

export function withRegion(criteria: Criteria, region: string, allowed: boolean): Criteria {
  const has = criteria.allowed_regions.includes(region);
  if (allowed === has) return criteria;
  if (!allowed && criteria.allowed_regions.length === 1) return criteria;
  return {
    ...criteria,
    allowed_regions: allowed ? [...criteria.allowed_regions, region] : criteria.allowed_regions.filter((item) => item !== region),
  };
}
