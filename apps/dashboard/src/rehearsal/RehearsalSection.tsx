import { useMemo } from "react";
import { CaveatsList } from "~/rehearsal/CaveatsList";
import { ComponentHealthTable } from "~/rehearsal/ComponentHealthTable";
import { FailureCard } from "~/rehearsal/FailureCard";
import { FallbackSummary } from "~/rehearsal/FallbackSummary";
import { InfrastructureCard } from "~/rehearsal/InfrastructureCard";
import { buildRehearsalModel } from "~/rehearsal/model";
import { PhaseTimeline } from "~/rehearsal/PhaseTimeline";
import { RehearsalExtras } from "~/rehearsal/RehearsalExtras";
import { RehearsalHeader } from "~/rehearsal/RehearsalHeader";
import { TrafficCard } from "~/rehearsal/TrafficCard";
import type { RehearsalDocument } from "~/rehearsal/types";
import { VerdictBanner } from "~/rehearsal/VerdictBanner";

export function RehearsalSection({ rehearsal }: { rehearsal: RehearsalDocument }) {
  const model = useMemo(() => buildRehearsalModel(rehearsal), [rehearsal]);

  return (
    <div className="flex flex-col gap-6">
      <RehearsalHeader context={model.context} />
      <VerdictBanner verdict={model.verdict} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TrafficCard traffic={model.traffic} />
        <FailureCard failure={model.failure} />
      </div>

      <PhaseTimeline timeline={model.timeline} />
      <ComponentHealthTable components={model.components} counts={model.componentCounts} />
      <FallbackSummary fallback={model.fallback} />
      <CaveatsList caveats={model.caveats} />
      <InfrastructureCard infrastructure={model.infrastructure} />
      <RehearsalExtras extras={model.extras} />
    </div>
  );
}
