import type { FormEvent, ReactNode } from "react";
import { canStart, onpremChoice, targetChoices, withProject, withTarget } from "~/onboarding/answers";
import { CriteriaFields } from "~/onboarding/CriteriaFields";
import { EstateApps } from "~/onboarding/EstateApps";
import { ProjectHeld } from "~/onboarding/ProjectHeld";
import { NEW_SITE, SiteFields } from "~/onboarding/SiteFields";
import { SaveProfileDialog, type SaveChoice } from "~/onboarding/SaveProfileDialog";
import { projectFacts, projectLabel } from "~/onboarding/projectFacts";
import { StatusBadge } from "~/ui/StatusBadge";
import type { RunSummary } from "~/runs/types";
import type { Answers, Choice, FocusMode, OnboardingSetup, Profile } from "~/onboarding/types";

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
  profile?: Profile;
};


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

export function OnboardingForm({ setup, answers, onAnswers, onStart, starting, error, holder = null, onOpenRun, saveChoice = null, profile }: OnboardingFormProps) {
  const estate = setup.projects.find((project) => project.id === answers.project);
  const applications = estate?.applications ?? [];
  let step = 0;
  const next = (title: string) => `${(step += 1)}. ${title}`;
  const onprem = onpremChoice(setup, answers);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart();
  };

  return (
    <form aria-label="New run" onSubmit={submit} className="flex w-full flex-col gap-6">
      <Section title={next("Connect the infrastructure")}>
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

      <Section title={next("Pick the estate")}>
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
              onChange={() => onAnswers(withProject(setup, answers, project.id, profile))}
            />
          ))
        )}
      </Section>

      {applications.length > 0 ? (
        <Section title={next("Projects in this estate")}>
          <p className="text-caption text-fg-muted">Each project scales on its own users. They start from the estate's plan; change them for this run.</p>
          <EstateApps applications={applications} answers={answers} onAnswers={onAnswers} />
        </Section>
      ) : null}

      <Section title={next("Focus")}>
        {applications.length > 0 ? (
          <div role="radiogroup" aria-label="Focus for" className="flex flex-wrap gap-4">
            {([["plan", "One focus for the whole plan"], ["project", "Each project's own focus"]] as const).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-2 text-label text-fg">
                <input type="radio" name="focus-mode" value={mode} checked={answers.focusMode === mode} onChange={() => onAnswers({ ...answers, focusMode: mode as FocusMode })} className="accent-accent" />
                {label}
              </label>
            ))}
          </div>
        ) : null}
        {answers.focusMode === "project" && applications.length > 0 ? (
          <p className="text-caption text-fg-muted">Each project uses the focus set in Projects in this estate, starting from Configuration.</p>
        ) : (
          <>
            <p className="text-caption text-fg-muted">One focus for this run. The default comes from Configuration.</p>
            <CriteriaFields criteria={answers.criteria} markets={setup.markets} onChange={(criteria) => onAnswers({ ...answers, criteria })} />
          </>
        )}
      </Section>

      <Section title={next("Where it may move")}>
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
        <Section title={next("On-prem")}>
          <Checkbox name="onprem" choice={onprem} onChange={(checked) => onAnswers({ ...answers, onprem: checked, site: checked ? answers.site ?? NEW_SITE : answers.site })} />
          <p className="text-caption text-fg-muted">Infrared prices the hardware, the space and the people to run it. The site comes from your profile; change it here for this run.</p>
          {answers.onprem && answers.site ? <SiteFields id="analysis-site" site={answers.site} onChange={(site) => onAnswers({ ...answers, site })} /> : null}
        </Section>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        {holder ? <ProjectHeld run={holder} onOpen={() => onOpenRun?.(holder.id)} /> : null}
        {saveChoice ? <SaveProfileDialog choice={saveChoice} /> : null}
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
