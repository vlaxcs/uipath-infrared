import type { Candidate, ResultDocument } from "~/candidates/types";

function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
  const aRank = a.rank ?? Number.POSITIVE_INFINITY;
  const bRank = b.rank ?? Number.POSITIVE_INFINITY;
  if (aRank !== bRank) return aRank - bRank;
  if (a.violation_distance !== b.violation_distance) return a.violation_distance - b.violation_distance;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function orderedCandidates(result: ResultDocument): Candidate[] {
  return [...result.candidates].sort(compareCandidates);
}

export function findCandidate(result: ResultDocument, id: string): Candidate | null {
  return result.candidates.find((candidate) => candidate.id === id) ?? null;
}

export function winnerCandidate(result: ResultDocument): Candidate | null {
  return result.winner ? findCandidate(result, result.winner) : null;
}

export function closestCandidate(result: ResultDocument): Candidate | null {
  const id = result.closest_if_none_feasible?.candidate;
  return id ? findCandidate(result, id) : null;
}

export function defaultCandidateId(result: ResultDocument): string | null {
  return (
    winnerCandidate(result)?.id ??
    closestCandidate(result)?.id ??
    orderedCandidates(result)[0]?.id ??
    null
  );
}
