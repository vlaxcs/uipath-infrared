import { useState } from "react";
import { createDeviceSignIn } from "~/account/deviceSignIn";
import { loginError } from "~/account/session";
import { Mascot } from "~/mascot/Mascot";
import { DeviceCodePanel } from "~/pages/DeviceCodePanel";

type LoginPageProps = {
  orchestratorUrl: string | null;
  onContinue: () => void;
  onSignedIn: () => void;
};

export function LoginPage({ orchestratorUrl, onContinue, onSignedIn }: LoginPageProps) {
  const error = loginError(window.location.search);
  const [signIn] = useState(() => (orchestratorUrl ? createDeviceSignIn(orchestratorUrl) : null));
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4 text-fg">
      <section aria-labelledby="login-title" className="flex w-full max-w-sm flex-col items-center gap-6 rounded-card border border-border bg-surface p-8">
        <Mascot animation="float" className="h-32 w-32" />
        <h1 id="login-title" className="text-title font-semibold tracking-tight">Sign in to Infrared</h1>
        {error && (
          <p role="alert" className="w-full rounded-control border border-status-failed px-3 py-2 text-label text-status-failed">
            {error}
          </p>
        )}
        {signIn ? (
          <DeviceCodePanel signIn={signIn} onSignedIn={onSignedIn} />
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-control bg-accent px-4 py-3 text-label font-medium text-on-accent hover:opacity-90"
          >
            Continue with sample data
          </button>
        )}
      </section>
    </main>
  );
}
