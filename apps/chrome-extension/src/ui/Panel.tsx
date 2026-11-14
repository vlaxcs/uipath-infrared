import { formatEUR, formatHours, formatTimestamp } from "~/domain/format";
import { headlineOf, primaryActionOf, type Headline } from "~/domain/headline";
import { NOTICE_SHORT_LABEL } from "~/domain/notice";
import { runStatusLabel, runStatusMeta } from "~/domain/status";
import type { LatestRun, Notice } from "~/domain/types";
import { CollapseIcon, RefreshIcon, SettingsIcon } from "~/ui/icons";
import { PipelineStrip } from "~/ui/PipelineStrip";
import { StatusBadge } from "~/ui/StatusBadge";

type PanelProps = {
  run: LatestRun | null;
  notice?: Notice;
  loading: boolean;
  collapsed: boolean;
  dashboardUrl: string;
  onToggleCollapsed: () => void;
  onRefresh: () => void;
  onOpenOptions: () => void;
};

export function Panel({
  run,
  notice,
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
        {run ? (
          <PillSummary run={run} />
        ) : notice ? (
          <span className="ir-pill-status">{NOTICE_SHORT_LABEL[notice.kind]}</span>
        ) : null}
      </button>
    );
  }

  return (
    <aside
      id="ir-panel"
      className={`ir-panel${run ? "" : " ir-panel-compact"}`}
      aria-label="Infrared latest run"
    >
      <header className="ir-header">
        <div className="ir-brand">
          <span className="ir-brand-dot" aria-hidden="true" />
          <span>Infrared</span>
        </div>
        <div className="ir-header-actions">
          <button
            type="button"
            className={`ir-icon-button${loading ? " ir-spinning" : ""}`}
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
          <button
            type="button"
            className="ir-icon-button"
            onClick={onOpenOptions}
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon />
          </button>
          <button
            type="button"
            className="ir-icon-button"
            onClick={onToggleCollapsed}
            aria-label="Collapse Infrared"
            title="Collapse"
            aria-expanded="true"
            aria-controls="ir-panel"
          >
            <CollapseIcon />
          </button>
        </div>
      </header>

      {loading && !run ? (
        <p className="ir-empty" role="status">
          Loading…
        </p>
      ) : run ? (
        <RunBody run={run} dashboardUrl={dashboardUrl} />
      ) : (
        <NoticeView
          notice={notice ?? { kind: "no-runs", message: "No runs yet" }}
          dashboardUrl={dashboardUrl}
          onOpenOptions={onOpenOptions}
        />
      )}
    </aside>
  );
}

function RunBody({ run, dashboardUrl }: { run: LatestRun; dashboardUrl: string }) {
  const action = primaryActionOf(run);
  const [topSuggestion, ...otherSuggestions] = run.runners;

  return (
    <>
      <section className="ir-hero" aria-label="Monthly cost" title={`Updated ${formatTimestamp(run.updatedAt)}`}>
        <p className="ir-project">{run.project}</p>
        <HeadlineView headline={headlineOf(run)} />
      </section>

      <div className="ir-progress" aria-live="polite">
        <StatusBadge label={runStatusLabel(run)} tone={runStatusMeta[run.status].tone} />
        <PipelineStrip steps={run.steps} />
      </div>

      {topSuggestion ? (
        <section className="ir-tip" aria-label="Runner suggestion" title={topSuggestion.detail}>
          <p className="ir-tip-title">{topSuggestion.title}</p>
          <p className="ir-tip-meta">
            <span className="ir-mono">{topSuggestion.runnerType}</span> · {formatHours(topSuggestion.hours)}
            {otherSuggestions.length > 0 ? ` · +${otherSuggestions.length} more` : ""}
          </p>
        </section>
      ) : null}

      <a
        className={`ir-action ir-action-${action.emphasis}`}
        href={`${dashboardUrl}/#/runs/${encodeURIComponent(run.id)}`}
        target="_blank"
        rel="noreferrer"
      >
        {action.label}
      </a>
    </>
  );
}

function NoticeView({
  notice,
  dashboardUrl,
  onOpenOptions,
}: {
  notice: Notice;
  dashboardUrl: string;
  onOpenOptions: () => void;
}) {
  return (
    <div className={`ir-notice ir-notice-${notice.kind}`} role="status" title={notice.detail}>
      <span className="ir-notice-dot" aria-hidden="true" />
      <span className="ir-notice-message">{notice.message}</span>
      {notice.kind === "no-access" ? (
        <button type="button" className="ir-notice-link" onClick={onOpenOptions}>
          Connect
        </button>
      ) : (
        <a className="ir-notice-link" href={`${dashboardUrl}/`} target="_blank" rel="noreferrer">
          Open dashboard
        </a>
      )}
    </div>
  );
}

function HeadlineView({ headline }: { headline: Headline }) {
  switch (headline.kind) {
    case "saving":
      return (
        <>
          <p className="ir-hero-line">
            <span className="ir-hero-value ir-hero-saving">{formatEUR(headline.amount)}</span>
            <span className="ir-hero-unit">/mo saved</span>
            {headline.percent !== null ? <span className="ir-hero-percent">−{headline.percent}%</span> : null}
          </p>
          <p className="ir-hero-sub">
            {formatEUR(headline.before)} → {formatEUR(headline.after)}
          </p>
        </>
      );
    case "no-saving":
      return (
        <>
          <p className="ir-hero-line">
            <span className="ir-hero-value">No saving</span>
          </p>
          <p className="ir-hero-sub">
            {formatEUR(headline.before)} → {formatEUR(headline.after)}
          </p>
        </>
      );
    case "current":
      return (
        <p className="ir-hero-line">
          <span className="ir-hero-value">{formatEUR(headline.before)}</span>
          <span className="ir-hero-unit">/mo today</span>
        </p>
      );
    case "unpriced":
      return (
        <p className="ir-hero-line">
          <span className="ir-hero-value ir-hero-muted">Not priced yet</span>
        </p>
      );
  }
}

function PillSummary({ run }: { run: LatestRun }) {
  const headline = headlineOf(run);
  if (headline.kind === "saving") {
    return <span className="ir-pill-status ir-pill-saving">−{formatEUR(headline.amount)}/mo</span>;
  }
  return <span className="ir-pill-status">{runStatusLabel(run)}</span>;
}
