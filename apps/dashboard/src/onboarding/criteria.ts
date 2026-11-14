import type { Criteria, Focus, Profile } from "~/onboarding/types";

export const FOCUSES: readonly { id: Focus; label: string; effect: string }[] = [
  { id: "availability", label: "High availability", effect: "At least 99.95% and 2 zones. Ranks by risk." },
  { id: "zone", label: "Zones", effect: "Keeps data in the regions allowed for the market you sell in." },
  { id: "performance", label: "Performance", effect: "Not scored by the engine yet. Ranks balanced." },
  { id: "cost", label: "Cost reduction", effect: "Keeps the project's constraints. Ranks by cost." },
];

export const MARKETS: readonly { code: string; label: string; regions: string }[] = [
  { code: "at", label: "Austria", regions: "eu-*" },
  { code: "be", label: "Belgium", regions: "eu-*" },
  { code: "dk", label: "Denmark", regions: "eu-*" },
  { code: "fi", label: "Finland", regions: "eu-*" },
  { code: "fr", label: "France", regions: "eu-*" },
  { code: "de", label: "Germany", regions: "eu-*" },
  { code: "ie", label: "Ireland", regions: "eu-*" },
  { code: "it", label: "Italy", regions: "eu-*" },
  { code: "nl", label: "Netherlands", regions: "eu-*" },
  { code: "no", label: "Norway", regions: "eu-*" },
  { code: "pl", label: "Poland", regions: "eu-*" },
  { code: "pt", label: "Portugal", regions: "eu-*" },
  { code: "ro", label: "Romania", regions: "eu-*" },
  { code: "es", label: "Spain", regions: "eu-*" },
  { code: "se", label: "Sweden", regions: "eu-*" },
  { code: "ch", label: "Switzerland", regions: "eu-*" },
  { code: "gb", label: "United Kingdom", regions: "eu-*" },
  { code: "us", label: "United States", regions: "us-*" },
];

export const DEFAULT_MARKET = "fr";

export const DEFAULT_CRITERIA: Criteria = { focus: "cost" };

export const DEFAULT_PROFILE: Profile = { criteria: DEFAULT_CRITERIA, onprem: { wanted: false } };

export function withFocus(focus: Focus, market: string | undefined): Criteria {
  return focus === "zone" ? { focus, market: market ?? DEFAULT_MARKET } : { focus };
}

export function marketsOffered(codes: readonly string[] | undefined): readonly (typeof MARKETS)[number][] {
  return codes ? MARKETS.filter((market) => codes.includes(market.code)) : MARKETS;
}
