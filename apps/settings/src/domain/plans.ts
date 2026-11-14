import type { PlanOffer } from "~/domain/types";

export const RUN_PACK_RUNS = 5;

export const PLAN_OFFERS: PlanOffer[] = [
  {
    id: "run_pack",
    name: "Run pack",
    priceUsd: 100,
    cadence: "one_time",
    runs: RUN_PACK_RUNS,
    features: ["5 runs, started from the dashboard", "Full report and rehearsal per run", "Runs never expire"],
  },
  {
    id: "subscription",
    name: "Subscription",
    priceUsd: 200,
    cadence: "monthly",
    runs: null,
    features: ["Runs scheduled in the cloud", "Slack approvals and alerts", "Cancel any time"],
  },
];

export function offerFor(id: PlanOffer["id"]): PlanOffer {
  return PLAN_OFFERS.find((offer) => offer.id === id)!;
}
