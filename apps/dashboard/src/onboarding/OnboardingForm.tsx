import type { FormEvent, ReactNode } from "react";
import { canStart, onpremChoice, targetChoices, withProject, withTarget } from "~/onboarding/answers";
import { CriteriaFields } from "~/onboarding/CriteriaFields";
import type { Answers, Choice, OnboardingSetup } from "~/onboarding/types";

type OnboardingFormProps = {
  setup: OnboardingSetup;
  answers: Answers;
  onAnswers: (answers: Answers) => void;
  onStart: () => void;
  starting: boolean;
  error: string | null;
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

export function OnboardingForm({ setup, answers, onAnswers, onStart, starting, error }: OnboardingFormProps) {
  const onprem = onpremChoice(setup, answers);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart();
  };

  return (
    <form aria-label="New run" onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
      <Section title="1. Connect the infrastructure">
        {setup.connections.map((connection) => (
          <Option
            key={connection.id}
            type="radio"
            name="connection"
            id={connection.id}
            label={connection.label}
            checked={answers.connection === connection.id}
            onChange={() => onAnswers({ ...answers, connection: connection.id })}
          />
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
              label={project.id}
              hint={project.description || undefined}
              checked={answers.project === project.id}
              onChange={() => onAnswers(withProject(setup, answers, project.id))}
            />
          ))
        )}
      </Section>

      <Section title="3. Where it may move">
        {targetChoices(setup, answers).map((choice) => (
          <Checkbox
            key={choice.id}
            name="target"
            choice={choice}
            onChange={(checked) => onAnswers(withTarget(answers, choice.id, checked))}
          />
        ))}
      </Section>

      <Section title="4. Criteria">
        <CriteriaFields criteria={answers.criteria} onChange={(criteria) => onAnswers({ ...answers, criteria })} />
      </Section>

      {onprem ? (
        <Section title="5. On-prem">
          <Checkbox name="onprem" choice={onprem} onChange={(checked) => onAnswers({ ...answers, onprem: checked })} />
          <p className="text-caption text-fg-muted">Infrared prices the hardware, the space and the people to run it.</p>
        </Section>
      ) : null}

      <div className="flex flex-col items-start gap-3">
        <button
          type="submit"
          disabled={starting || !canStart(setup, answers)}
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
