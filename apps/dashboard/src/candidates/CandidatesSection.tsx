import { useMemo, useState } from "react";
import { BaselineSummary } from "~/candidates/BaselineSummary";
import { CandidateDetail } from "~/candidates/CandidateDetail";
import { CandidateList } from "~/candidates/CandidateList";
import { CandidatesEmptyState } from "~/candidates/CandidatesEmptyState";
import { buildCandidatesModel } from "~/candidates/model";
import { NothingFeasibleNotice } from "~/candidates/NothingFeasibleNotice";
import { ResultHeader } from "~/candidates/ResultHeader";
import type { ResultDocument } from "~/candidates/types";

export function CandidatesSection({ result }: { result: ResultDocument }) {
  const model = useMemo(() => buildCandidatesModel(result), [result]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId =
    selectedId && model.candidates.some((candidate) => candidate.id === selectedId)
      ? selectedId
      : model.defaultId;
  const selected = model.candidates.find((candidate) => candidate.id === activeId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <ResultHeader context={model.context} counts={model.counts} flags={model.flags} />
      <BaselineSummary baseline={model.baseline} />
      <NothingFeasibleNotice notice={model.nothingFeasible} />

      {model.candidates.length === 0 ? (
        <CandidatesEmptyState />
      ) : (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <div className="flex w-full flex-col gap-3 xl:w-80 xl:shrink-0">
            <h2 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
              Ranked candidates
            </h2>
            <CandidateList
              candidates={model.candidates}
              selectedId={activeId}
              onSelect={setSelectedId}
            />
          </div>

          <div className="min-w-0 flex-1">
            {selected ? <CandidateDetail candidate={selected} /> : <CandidatesEmptyState />}
          </div>
        </div>
      )}
    </div>
  );
}
