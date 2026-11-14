import { useId } from "react";
import { MAX_INTENT, withApp, withAppFocus } from "~/onboarding/answers";
import { FOCUSES, marketsOffered, withFocus } from "~/onboarding/criteria";
import type { Answers, Application, Criteria, Focus } from "~/onboarding/types";

const INPUT = "w-full min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-label text-fg";
const LABEL = "flex min-w-0 flex-col gap-1 text-caption text-fg-muted";
const DEFAULT = "default";
const NEAR_LIMIT = MAX_INTENT - 200;
const METRICS: Record<string, string> = {
  monthly_active_users: "monthly active users",
  daily_active_users: "daily active users",
  internal_users: "internal users",
  monthly_visitors: "monthly visitors",
};

type ProjectCardsProps = {
  applications: readonly Application[];
  answers: Answers;
  markets?: readonly string[];
  onAnswers: (answers: Answers) => void;
};

function focusLabel(criteria: Criteria): string {
  return FOCUSES.find((focus) => focus.id === criteria.focus)?.label ?? criteria.focus;
}

export function ProjectCards({ applications, answers, markets, onAnswers }: ProjectCardsProps) {
  const id = useId();
  const offered = marketsOffered(markets);
  return (
    <ul aria-label="Projects" className="flex flex-col gap-3">
      {applications.map((app) => {
        const answer = answers.apps.find((item) => item.id === app.id);
        if (!answer) return null;
        const field = (name: string) => `${id}-${app.id}-${name}`;
        const number = (value: string) => (value === "" ? 0 : Math.round(Number(value)));
        const own = answer.criteria;
        const intent = answer.intent ?? "";
        return (
          <li key={app.id} aria-label={app.name} className="flex flex-col gap-3 rounded-card border border-border bg-surface-muted p-4">
            <div className="flex flex-col gap-1">
              <span className="text-label font-semibold text-fg">{app.name}</span>
              {app.summary ? <span className="text-caption text-fg-muted">{app.summary}</span> : null}
              {app.stacks.length > 0 ? <span className="font-mono text-caption text-fg-subtle">{app.stacks.join(", ")}</span> : null}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <label htmlFor={field("focus")} className={LABEL}>
                Focus
                <select
                  id={field("focus")}
                  value={own?.focus ?? DEFAULT}
                  onChange={(event) => onAnswers(withAppFocus(answers, app.id, event.target.value === DEFAULT ? null : withFocus(event.target.value as Focus, own?.market)))}
                  className={INPUT}
                >
                  <option value={DEFAULT}>Default focus ({focusLabel(answers.criteria)})</option>
                  {FOCUSES.map((focus) => (
                    <option key={focus.id} value={focus.id}>{focus.label}</option>
                  ))}
                </select>
              </label>
              {own?.focus === "zone" ? (
                <label htmlFor={field("market")} className={LABEL}>
                  Market
                  <select id={field("market")} value={own.market} onChange={(event) => onAnswers(withAppFocus(answers, app.id, { focus: "zone", market: event.target.value }))} className={INPUT}>
                    {offered.map((market) => (
                      <option key={market.code} value={market.code}>{market.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className={LABEL}>
              <label htmlFor={field("intent")}>What do you want to do with it next? (optional)</label>
              <textarea
                id={field("intent")}
                rows={3}
                maxLength={MAX_INTENT}
                value={intent}
                aria-describedby={intent.length >= NEAR_LIMIT ? field("intent-count") : undefined}
                onChange={(event) => onAnswers(withApp(answers, app.id, { intent: event.target.value }))}
                className={INPUT}
              />
              {intent.length >= NEAR_LIMIT ? (
                <span id={field("intent-count")} className="text-caption text-fg-subtle">
                  {intent.length} of {MAX_INTENT} characters
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
