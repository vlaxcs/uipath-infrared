import type { CandidatesModel } from "~/candidates/model";
import { ViolationList } from "~/candidates/ViolationList";
import { StatusBadge } from "~/ui/StatusBadge";

export function NothingFeasibleNotice({ notice }: { notice: CandidatesModel["nothingFeasible"] }) {
  if (!notice) return null;
  return (
    <section
      aria-labelledby="nothing-feasible-title"
      className="flex flex-col gap-3 rounded-card border border-status-failed bg-surface p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="nothing-feasible-title" className="text-title font-semibold">
          No feasible candidate
        </h3>
        <StatusBadge label="Blocked by hard constraints" tone="failed" />
      </div>

      {notice.closestId ? (
        <p className="text-body text-fg-muted">
          The closest plan is <span className="font-mono">{notice.closestId}</span>
          {notice.distance ? `, missing the constraints by ${notice.distance}` : ""}. These constraints
          block it:
        </p>
      ) : (
        <p className="text-body text-fg-muted">
          No closest candidate was recorded, and every plan breaks a hard constraint.
        </p>
      )}

      <ViolationList violations={notice.blockedBy} label="Blocking constraints" />
    </section>
  );
}
