import { OnboardingSection } from "~/onboarding/OnboardingSection";

export function AnalyzePage({ onFollowRun }: { onFollowRun: (runId: string) => void }) {
  return (
    <section aria-labelledby="analyze-title" className="mx-auto flex max-w-3xl animate-panel-in flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 id="analyze-title" className="text-display font-semibold tracking-tight">New analysis</h1>
        <p className="text-body text-fg-muted">Defaults come from Configuration. Starting takes one run.</p>
      </header>
      <OnboardingSection onFollowRun={onFollowRun} />
    </section>
  );
}
