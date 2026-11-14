import { formatEUR, formatTimestamp } from "~/domain/format";
import { gateMeta, runStatusLabel, runStatusMeta, stepLabel } from "~/domain/status";
import type { LatestRun } from "~/domain/types";
import { PipelineStrip } from "~/ui/PipelineStrip";
import { StatusBadge } from "~/ui/StatusBadge";
import { SuggestionList } from "~/ui/SuggestionList";

type PanelProps = {
  run: LatestRun | null;
  note?: string;
  loading: boolean;
  collapsed: boolean;
  dashboardUrl: string;
  onToggleCollapsed: () => void;
  onRefresh: () => void;
  onOpenOptions: () => void;
};

export function Panel({
  run,
  note,
  loading,
  collapsed,
  dashboardUrl,
  onToggleCollapsed,
  onRefresh,
  onOpenOptions,
}: PanelProps) {
  if (collapsed) {
    return (
      <button
        type="button"
        className="ir-pill"
        onClick={onToggleCollapsed}
        aria-label="Open Infrared"
        aria-expanded="false"
        aria-controls="ir-panel"
      >
        <span className="ir-brand-dot" aria-hidden="true" />
        <span className="ir-pill-name">Infrared</span>
        {run ? <span className="ir-pill-status">{runStatusLabel(run)}</span> : null}
      </button>
    );
  }

  return (
    <aside id="ir-panel" className="ir-panel" aria-label="Infrared latest run">
      <header className="ir-header">
        <div className="ir-brand">
          <span className="ir-brand-dot" aria-hidden="true" />
          <span>Infrared</span>
        </div>
        <div className="ir-header-actions">
          {run ? (
            <StatusBadge
              label={run.source === "live" ? "Live" : "Sample data"}
              tone={run.source === "live" ? "running" : "neutral"}
            />
          ) : null}
          <button
            type="button"
            className="ir-icon-button"
            onClick={onToggleCollapsed}
            aria-label="Collapse Infrared"
            aria-expanded="true"
            aria-controls="ir-panel"
          >
            −
          </button>
        </div>
      </header>

      {loading && !run ? (
        <p className="ir-muted ir-small" role="status">
          Loading the latest run…
        </p>
      ) : run ? (
        <>
          <section className="ir-run" aria-label="Latest run">
            <div className="ir-run-head">
              <div>
                <p className="ir-project">{run.project}</p>
                <p className="ir-id">{run.id}</p>
              </div>
              <StatusBadge label={runStatusLabel(run)} tone={runStatusMeta[run.status].tone} />
            </div>

            <p className="ir-meta" aria-live="polite">
              {stepLabel(run.step)} · revision {run.revision}/{run.maxRevisions}
              {run.awaiting ? ` · ${gateMeta[run.awaiting].label}` : ""}
            </p>
            <p className="ir-updated">Updated {formatTimestamp(run.updatedAt)}</p>

            {run.source === "sample" && run.note ? (
              <p className="ir-sample-note">{run.note}</p>
            ) : null}

            {run.before === null && run.after === null ? (
              <p className="ir-muted ir-small">Not priced yet.</p>
            ) : (
              <>
                <div className="ir-prices">
                  <div className="ir-price">
                    <span className="ir-price-label">Before</span>
                    <span className="ir-price-value">
                      {formatEUR(run.before)}
                      {run.before !== null ? <span className="ir-price-unit">/mo</span> : null}
                    </span>
                  </div>
                  <span className="ir-arrow" aria-hidden="true">
                    →
                  </span>
                  <div className="ir-price">
                    <span className="ir-price-label">After (winner)</span>
                    <span className="ir-price-value">
                      {formatEUR(run.after)}
                      {run.after !== null ? <span className="ir-price-unit">/mo</span> : null}
                    </span>
                  </div>
                </div>
                {run.winner ? (
                  <p className="ir-winner-line">
                    Winner: <span className="ir-mono">{run.winner}</span>
                    {run.pickedLayout && run.pickedLayout !== run.winner ? (
                      <>
                        {" "}
                        · Picked: <span className="ir-mono">{run.pickedLayout}</span>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </>
            )}

            <PipelineStrip steps={run.steps} />
          </section>

          <section className="ir-runners" aria-labelledby="ir-runners-title">
            <div className="ir-runners-head">
              <h3 id="ir-runners-title" className="ir-section-title">
                Runner suggestions
              </h3>
              {run.runnerSourceRepo ? <span className="ir-repo">{run.runnerSourceRepo}</span> : null}
            </div>
            <SuggestionList suggestions={run.runners} note={run.runnerNote} />
            <p className="ir-caption">
              Derived from job durations (estimated); excludes pricing and idle runner time.
            </p>
          </section>

          <p className="ir-caption">Approvals happen in the dashboard. This card is read-only.</p>
        </>
      ) : (
        <p className="ir-muted ir-small">{note ?? "No run yet."}</p>
      )}

      <footer className="ir-footer">
        {run ? (
          <a
            className="ir-link"
            href={`${dashboardUrl}/#/runs/${encodeURIComponent(run.id)}`}
            target="_blank"
            rel="noreferrer"
          >
            Open dashboard
          </a>
        ) : (
          <span />
        )}
        <div className="ir-footer-actions">
          <button type="button" className="ir-button" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="ir-button" onClick={onOpenOptions}>
            Settings
          </button>
        </div>
      </footer>
    </aside>
  );
}
