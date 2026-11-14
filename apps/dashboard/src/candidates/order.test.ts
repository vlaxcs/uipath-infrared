import { describe, expect, it } from "vitest";
import {
  closestCandidate,
  defaultCandidateId,
  findCandidate,
  orderedCandidates,
  winnerCandidate,
} from "~/candidates/order";
import { makeCandidate, makeResult } from "~/candidates/fixtures";

const ranked = (id: string, rank: number) => makeCandidate({ id, rank });
const infeasible = (id: string, distance: number) =>
  makeCandidate({ id, feasible: false, rank: null, violation_distance: distance });

describe("ordering candidates", () => {
  it("puts feasible candidates by rank, then infeasible by distance", () => {
    const result = makeResult({
      candidates: [
        infeasible("slow", 2),
        ranked("third", 3),
        ranked("first", 1),
        infeasible("near", 0.5),
        ranked("second", 2),
      ],
      winner: "first",
    });

    expect(orderedCandidates(result).map((candidate) => candidate.id)).toEqual([
      "first",
      "second",
      "third",
      "near",
      "slow",
    ]);
    expect(result.candidates.map((candidate) => candidate.id)).toEqual([
      "slow",
      "third",
      "first",
      "near",
      "second",
    ]);
  });

  it("finds candidates by id", () => {
    const result = makeResult({ candidates: [makeCandidate({ id: "w" })], winner: "w" });
    expect(findCandidate(result, "w")?.id).toBe("w");
    expect(findCandidate(result, "missing")).toBeNull();
    expect(winnerCandidate(result)?.id).toBe("w");
    expect(winnerCandidate(makeResult({ winner: "missing" }))).toBeNull();
  });

  it("finds the closest candidate when nothing is feasible", () => {
    const result = makeResult({
      candidates: [makeCandidate({ id: "near", feasible: false, rank: null })],
      winner: null,
      closest_if_none_feasible: { candidate: "near", violation_distance: 1, blocked_by: [] },
    });
    expect(closestCandidate(result)?.id).toBe("near");
  });

  it("defaults to the winner, then the closest, then the first ordered", () => {
    const winner = makeResult({
      candidates: [makeCandidate({ id: "b", rank: 2 }), makeCandidate({ id: "a", rank: 1 })],
      winner: "a",
    });
    expect(defaultCandidateId(winner)).toBe("a");

    const closest = makeResult({
      candidates: [
        makeCandidate({ id: "b", feasible: false, rank: null }),
        makeCandidate({ id: "a", feasible: false, rank: null }),
      ],
      winner: null,
      closest_if_none_feasible: { candidate: "b", violation_distance: 1, blocked_by: [] },
    });
    expect(defaultCandidateId(closest)).toBe("b");

    const bare = makeResult({
      candidates: [makeCandidate({ id: "z", rank: 2 }), makeCandidate({ id: "a", rank: 1 })],
      winner: null,
      closest_if_none_feasible: null,
    });
    expect(defaultCandidateId(bare)).toBe("a");
    expect(defaultCandidateId(makeResult({ candidates: [], winner: null }))).toBeNull();
  });
});
