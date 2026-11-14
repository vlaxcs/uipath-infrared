import type { FormEvent, ReactNode } from "react";
import { canStart, onpremChoice, targetChoices, withProject, withTarget } from "~/onboarding/answers";
import { CriteriaFields } from "~/onboarding/CriteriaFields";
import { ProjectHeld } from "~/onboarding/ProjectHeld";
import { NEW_SITE, SiteFields } from "~/onboarding/SiteFields";
import { projectFacts, projectLabel } from "~/onboarding/projectFacts";
import { StatusBadge } from "~/ui/StatusBadge";
import type { RunSummary } from "~/runs/types";
import type { Answers, Choice, OnboardingSetup } from "~/onboarding/types";

type OnboardingFormProps = {
  setup: OnboardingSetup;
  answers: Answers;
  onAnswers: (answers: Answers) => void;
  onStart: () => void;
  starting: boolean;
  error: string | null;
  holder?: RunSummary | null;
  onOpenRun?: (id: string) => void;
  saveChoice?: SaveChoice | null;
};

export type SaveChoice = { saving: boolean; onSave: () => void; onSkip: () => void; onBack: () => void };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-6">
      <legend className="px-1 text-label font-semibold text-fg">{title}</legend>
      {children}
    </fieldset>
  );
}

type OptionProps = {
  type: "radio" | "checkbox";
  name: string;
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (checked: boolean) => void;
};

function Option({ type, name, id, label, checked, disabled, hint, onChange }: OptionProps) {
  const inputId = `${name}-${id}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex items-start gap-3">
      <input
        id={inputId}
        type={type}
        name={name}
        value={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 accent-accent"
      />
      <div className="flex min-w-0 flex-col">
        <label htmlFor={inputId} className={disabled ? "text-label text-fg-subtle" : "text-label text-fg"}>
          {label}
        </label>
        {hint ? (
          <span id={hintId} className="text-caption text-fg-subtle">
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Checkbox({ name, choice, onChange }: { name: string; choice: Choice; onChange: (checked: boolean) => void }) {
  return (
    <Option
      type="checkbox"
      name={name}
      id={choice.id}
      label={choice.label}
      checked={choice.ticked}
      disabled={choice.disabled}
      hint={choice.hint}
      onChange={onChange}
    />
  );
}

function ConnectionState({ reachable, endpoint }: { reachable?: boolean; endpoint?: string }) {
  if (reachable === undefined) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <StatusBadge label={reachable ? "Connected" : "Not reachable"} tone={reachable ? "completed" : "failed"} />
      {endpoint ? <span className="font-mono text-caption text-fg-subtle">{endpoint}</span> : null}
    </span>
  );
}

export function OnboardingForm({ setup, answers, onAnswers, onStart, starting, error, holder = null, onOpenRun, saveChoice = null }: OnboardingFormProps) {
  const onprem = onpremChoice(setup, answers);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart();
  };

  return (
    <form aria-label="New run" onSubmit={submit} className="flex w-full flex-col gap-6">
      <Section title="1. Connect the infrastructure">
        {setup.connections.map((connection) => (
          <div key={connection.id} className="flex flex-wrap items-center justify-between gap-2">
            <Option
              type="radio"
              name="connection"
              id={connection.id}
              label={connection.label}
              checked={answers.connection === connection.id}
              onChange={() => onAnswers({ ...answers, connection: connection.id })}
            />
            <ConnectionState reachable={connection.reachable} endpoint={connection.endpoint} />
          </div>
        ))}
      </Section>

      <Section title="2. Pick the project">
        {setup.projects.length === 0 ? (
          <p className="text-label text-fg-muted">No projects yet. Add a forecast to the projects directory of the orchestrator.</p>
        ) : (
          setup.projects.map((project) => (
            <Option
              key={project.id}
              type="radio"
              name="project"
              id={project.id}
              label={projectLabel(project)}
              hint={projectFacts(project)}
              checked={answers.project === project.id}
              onChange={() => onAnswers(withProject(setup, answers, project.id))}
            />
          ))
        )}
      </Section>

      <Section title="3. Focus">
        <p className="text-caption text-fg-muted">One focus for this run. The default comes from Configuration.</p>
        <CriteriaFields criteria={answers.criteria} markets={setup.markets} onChange={(criteria) => onAnswers({ ...answers, criteria })} />
      </Section>

      <Section title="4. Where it may move">
        <div className="grid gap-3 sm:grid-cols-2">
          {targetChoices(setup, answers).map((choice) => (
            <Checkbox
              key={choice.id}
              name="target"
              choice={choice}
              onChange={(checked) => onAnswers(withTarget(answers, choice.id, checked))}
            />
          ))}
        </div>
      </Section>

      {onprem ? (
        <Section title="5. On-prem">
          <Checkbox name="onprem" choice={onprem} onChange={(checked) => onAnswers({ ...answers, onprem: checked, site: checked ? answers.site ?? NEW_SITE : answers.site })} />
          <p className="text-caption text-fg-muted">Infrared prices the hardware, the space and the people to run it. The site comes from your profile; change it here for this run.</p>
          {answers.onprem && answers.site ? <SiteFields id="analysis-site" site={answers.site} onChange={(site) => onAnswers({ ...answers, site })} /> : null}
        </Section>
      ) : null}

      <div className="flex flex-col items-start gap-3">
        {holder ? <ProjectHeld run={holder} onOpen={() => onOpenRun?.(holder.id)} /> : null}
        {saveChoice ? (
          <div role="group" aria-label="Save the on-prem details" className="flex flex-col gap-3 rounded-control border border-status-awaiting bg-surface-muted px-4 py-3">
            <p className="text-label text-fg">You changed the on-prem details. Save them to your profile too?</p>
            <p className="text-caption text-fg-muted">Saving makes them the default for every new analysis.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveChoice.onSave} disabled={saveChoice.saving} aria-busy={saveChoice.saving} className="rounded-control bg-accent px-4 py-2 text-label font-medium text-on-accent disabled:opacity-50">
                {saveChoice.saving ? "Saving" : "Save to profile and start"}
              </button>
              <button type="button" onClick={saveChoice.onSkip} disabled={saveChoice.saving} className="rounded-control border border-border-strong bg-surface px-4 py-2 text-label font-medium text-fg disabled:opacity-50">
                Start without saving
              </button>
              <button type="button" onClick={saveChoice.onBack} disabled={saveChoice.saving} className="rounded-control px-4 py-2 text-label font-medium text-fg-muted disabled:opacity-50">
                Back to the form
              </button>
            </div>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={starting || holder !== null || saveChoice !== null || !canStart(setup, answers)}
          aria-busy={starting}
          className="rounded-control bg-accent px-4 py-2 text-label font-medium text-on-accent disabled:opacity-50"
        >
          {starting ? "Starting the run" : "Start the run"}
        </button>
        {error ? (
          <p role="alert" className="text-label text-status-failed">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
