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
    <Card dense title="Plans">
      <ul className="flex flex-col divide-y divide-line">
        {PLAN_OFFERS.map((offer) => {
          const current = offer.id === subscription.plan;
          const charge = chargeFor(offer, subscription.plan);
          return (
            <li
              key={offer.id}
              aria-label={offer.name}
              className={`-mx-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2 py-2.5 first:pt-1 last:pb-1 ${current ? "border-l-2 border-l-accent" : ""}`}
            >
              <div className="flex min-w-40 items-baseline gap-2">
                <h3 className="type-label">{offer.name}</h3>
                <span className="type-label tabular-nums">{formatUsd(offer.priceUsd)}</span>
                <span className="type-small text-fg-muted">{offer.cadence === "monthly" ? "/ month" : `once, ${offer.runs} runs`}</span>
              </div>
              <p className="type-small min-w-0 flex-1 basis-60 text-fg-muted">{offer.features.join(" · ")}</p>
              {current ? (
                <Badge tone="accent">Current plan</Badge>
              ) : (
                <Button
                  size="sm"
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
