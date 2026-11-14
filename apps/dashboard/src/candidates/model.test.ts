import { describe, expect, it } from "vitest";
import {
  emptyResult,
  makeAction,
  makeCandidate,
  makeCost,
  makeResult,
  nothingFeasibleFixture,
  unknownVocabularyResult,
  unsupportedSchemaResult,
} from "~/candidates/fixtures";
import { buildCandidatesModel } from "~/candidates/model";

describe("the candidates view model", () => {
  it("summarises the result and gives the winner its steps", () => {
    const result = makeResult({
      candidates: [
        makeCandidate({ id: "winner", rank: 1, source: "agent", actions: [makeAction()] }),
        makeCandidate({
          id: "loser",
          rank: 2,
          source: "engine",
          lost_because: { reason: "cost", detail: "EUR 10 more" },
        }),
      ],
      winner: "winner",
    });

    const model = buildCandidatesModel(result);
    expect(model.context.project).toBe("startup");
    expect(model.context.horizon).toBe("24 months");
    expect(model.context.schemaSupported).toBe(true);
    expect(model.counts).toEqual({ total: 2, feasible: 2, infeasible: 0, pareto: 2 });
    expect(model.defaultId).toBe("winner");
    expect(model.winnerId).toBe("winner");
    expect(model.candidates[0].steps?.summary).toBe("1 step · 1 change");
    expect(model.candidates[1].steps).toBeNull();
    expect(model.candidates[1].whyLost?.label).toBe("Cost");
  });

  it("builds the nothing-feasible notice", () => {
    const model = buildCandidatesModel(nothingFeasibleFixture);
    expect(model.winnerId).toBeNull();
    expect(model.defaultId).toBe("almost");
    expect(model.nothingFeasible?.closestId).toBe("almost");
    expect(model.nothingFeasible?.distance).toBe("0.549");
    expect(model.nothingFeasible?.blockedBy[0].constraint).toBe("Monthly budget");
    expect(model.candidates[0].whyLost?.label).toBe("Hard constraint");
  });

  it("renders unknown vocabulary and unsupported schemas best-effort", () => {
    const model = buildCandidatesModel(unknownVocabularyResult);
    expect(model.context.schemaSupported).toBe(true);
    expect(model.candidates[0].whyLost?.label).toBe("Vibes");
    expect(model.candidates[0].flags).toEqual(["Brand new flag"]);
    expect(model.flags).toEqual(["Brand new flag"]);

    const unsupported = buildCandidatesModel(unsupportedSchemaResult);
    expect(unsupported.context.schemaSupported).toBe(false);
    expect(unsupported.candidates).toHaveLength(1);
  });

  it("handles an empty result", () => {
    const model = buildCandidatesModel(emptyResult);
    expect(model.candidates).toEqual([]);
    expect(model.defaultId).toBeNull();
    expect(model.nothingFeasible?.closestId).toBeNull();
  });

  it("includes the optional security and on-prem cost blocks", () => {
    const result = makeResult({
      candidates: [
        makeCandidate({
          id: "winner",
          cost: makeCost({
            security_remediation: { effort_hours: 10, one_off_eur: 1000, run_delta_eur_month: 30 },
            onprem_platform: {
              platform: "onprem-dc1",
              capacity_share: 0.5,
              capex_amortised_eur_month: 100,
              power_cooling_eur_month: 20,
              colocation_eur_month: 30,
              disk_replacement_eur_month: 5,
              staff_eur_month: 200,
            },
          }),
        }),
      ],
      winner: "winner",
    });

    const model = buildCandidatesModel(result);
    expect(model.candidates[0].securityRemediation).toHaveLength(3);
    expect(model.candidates[0].onpremPlatform[0]).toEqual({
      label: "Platform",
      value: "onprem-dc1",
    });
  });
});
