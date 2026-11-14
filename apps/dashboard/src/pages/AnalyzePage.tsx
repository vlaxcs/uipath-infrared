import { OnboardingSection } from "~/onboarding/OnboardingSection";

export function AnalyzePage({ onFollowRun }: { onFollowRun: (runId: string) => void }) {
  return (
    <section aria-label="Run analysis" className="flex animate-panel-in flex-col gap-6">
      <OnboardingSection onFollowRun={onFollowRun} />
    </section>
  );
}
