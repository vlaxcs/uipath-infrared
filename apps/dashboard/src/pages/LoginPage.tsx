import { Mascot } from "~/mascot/Mascot";

type LoginPageProps = {
  orchestratorUrl: string | null;
  onContinue: () => void;
};

export function LoginPage({ orchestratorUrl, onContinue }: LoginPageProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4 text-fg">
      <section aria-labelledby="login-title" className="flex w-full max-w-sm flex-col items-center gap-6 rounded-card border border-border bg-surface p-8">
        <Mascot animation="float" className="h-32 w-32" />
        <h1 id="login-title" className="text-title font-semibold tracking-tight">Sign in to Infrared</h1>
        {orchestratorUrl ? (
          <a
            href={`${orchestratorUrl}/auth/github`}
            className="w-full rounded-control bg-accent px-4 py-3 text-center text-label font-medium text-on-accent"
          >
            Sign in with GitHub
          </a>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-control bg-accent px-4 py-3 text-label font-medium text-on-accent"
          >
            Continue with sample data
          </button>
        )}
      </section>
    </main>
  );
}
