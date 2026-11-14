import { useId } from "react";
import { withApp, withAppFocus } from "~/onboarding/answers";
import { FOCUSES, MARKETS, withFocus } from "~/onboarding/criteria";
import type { Answers, Application } from "~/onboarding/types";

const INPUT = "w-full min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-label text-fg";
const LABEL = "flex min-w-0 flex-col gap-1 text-caption text-fg-muted";
const METRICS: Record<string, string> = {
  monthly_active_users: "monthly active users",
  daily_active_users: "daily active users",
  internal_users: "internal users",
  monthly_visitors: "monthly visitors",
};

type EstateAppsProps = { applications: readonly Application[]; answers: Answers; onAnswers: (answers: Answers) => void };

export function EstateApps({ applications, answers, onAnswers }: EstateAppsProps) {
  const id = useId();
  const perProject = answers.focusMode === "project";
  return (
    <ul aria-label="Projects in this estate" className="flex flex-col gap-3">
      {applications.map((app) => {
        const answer = answers.apps.find((item) => item.id === app.id);
        if (!answer) return null;
        const field = (name: string) => `${id}-${app.id}-${name}`;
        const number = (value: string) => (value === "" ? 0 : Math.round(Number(value)));
        return (
          <li key={app.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface-muted p-4">
            <div className="flex flex-col gap-1">
              <span className="text-label font-semibold text-fg">{app.name}</span>
              {app.summary ? <span className="text-caption text-fg-muted">{app.summary}</span> : null}
              <span className="font-mono text-caption text-fg-subtle">{app.stacks.join(", ")}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label htmlFor={field("now")} className={LABEL}>
                Now, {METRICS[app.users.metric] ?? app.users.metric}
                <input id={field("now")} type="number" min={1} value={answer.users_now} onChange={(event) => onAnswers(withApp(answers, app.id, { users_now: number(event.target.value) }))} className={INPUT} />
              </label>
              <label htmlFor={field("expected")} className={LABEL}>
                Expected
                <input id={field("expected")} type="number" min={1} value={answer.users_expected} onChange={(event) => onAnswers(withApp(answers, app.id, { users_expected: number(event.target.value) }))} className={INPUT} />
              </label>
              <label htmlFor={field("month")} className={LABEL}>
                By month
                <input id={field("month")} type="number" min={1} max={120} value={answer.at_month} onChange={(event) => onAnswers(withApp(answers, app.id, { at_month: number(event.target.value) }))} className={INPUT} />
              </label>
            </div>
            {perProject ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label htmlFor={field("focus")} className={LABEL}>
                  Focus
                  <select id={field("focus")} value={answer.criteria.focus} onChange={(event) => onAnswers(withAppFocus(answers, app.id, withFocus(event.target.value as Answers["criteria"]["focus"], answer.criteria.market)))} className={INPUT}>
                    {FOCUSES.map((focus) => (
                      <option key={focus.id} value={focus.id}>{focus.label}</option>
                    ))}
                  </select>
                </label>
                {answer.criteria.focus === "zone" ? (
                  <label htmlFor={field("market")} className={LABEL}>
                    Market
                    <select id={field("market")} value={answer.criteria.market} onChange={(event) => onAnswers(withAppFocus(answers, app.id, { focus: "zone", market: event.target.value }))} className={INPUT}>
                      {MARKETS.map((market) => (
                        <option key={market.code} value={market.code}>{market.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
