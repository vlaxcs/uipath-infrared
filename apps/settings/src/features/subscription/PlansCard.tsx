import { useSettings } from "~/app/settings-context";
import { formatUsd } from "~/app/format";
import { PLAN_OFFERS } from "~/domain/plans";
import type { PlanOffer, Plan } from "~/domain/types";
import { Badge } from "~/ui/Badge";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import type { ChargeKind } from "~/features/subscription/ChargeDialog";

function chargeFor(offer: PlanOffer, current: Plan): { kind: ChargeKind; label: string } {
  if (offer.id === "subscription") return { kind: "subscribe", label: "Switch to Subscription" };
  if (current === "subscription") return { kind: "downgrade", label: "Switch to Run pack" };
  return { kind: "buy_pack", label: "Buy run pack" };
}

export function PlansCard({ onCharge }: { onCharge(kind: ChargeKind): void }) {
  const { subscription } = useSettings();

  return (
    <Card title="Plans" description="Pay per run, or let Infrared schedule runs for you.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {PLAN_OFFERS.map((offer) => {
          const current = offer.id === subscription.plan;
          const charge = chargeFor(offer, subscription.plan);
          return (
            <li
              key={offer.id}
              aria-label={offer.name}
              className={`flex flex-col gap-4 rounded-well border p-4 ${current ? "border-accent bg-accent-soft" : "border-line bg-sunken"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="type-label">{offer.name}</h3>
                {current && <Badge tone="accent">Current plan</Badge>}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="type-figure">{formatUsd(offer.priceUsd)}</span>
                <span className="type-small text-fg-muted">{offer.cadence === "monthly" ? "per month" : `one-time, ${offer.runs} runs`}</span>
              </div>
              <ul className="type-small flex flex-col gap-1.5 text-fg-muted">
                {offer.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden className="text-accent">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              {!current && (
                <Button
                  className="mt-auto self-start"
                  variant={offer.id === "subscription" ? "primary" : "secondary"}
                  onClick={() => onCharge(charge.kind)}
                >
                  {charge.label}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
