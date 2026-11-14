import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DeviceCode, DeviceSignIn } from "~/account/deviceSignIn";

const SLOW_DOWN_SECONDS = 5;

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "waiting"; code: DeviceCode; deadline: number }
  | { kind: "ended"; message: string };

const ENDED = {
  expired: "The code expired before it was approved. Get a new one.",
  denied: "Sign-in was cancelled on GitHub. Approve Infrared to continue.",
  no_cookie: "Your browser did not keep the sign-in cookie, so the platform cannot finish. Allow cookies for this site and try again.",
};

const PRIMARY = "w-full rounded-control bg-accent px-4 py-3 text-center text-label font-medium text-on-accent hover:opacity-90";

export function DeviceCodePanel({ signIn, onSignedIn }: { signIn: DeviceSignIn; onSignedIn: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function start() {
    setPhase({ kind: "starting" });
    try {
      const code = await signIn.start();
      setPhase({ kind: "waiting", code, deadline: Date.now() + code.expiresIn * 1000 });
    } catch (cause) {
      setPhase({ kind: "ended", message: cause instanceof Error ? cause.message : "Sign-in did not start. Try again." });
    }
  }

  if (phase.kind === "waiting") {
    return (
      <WaitingForApproval
        code={phase.code}
        deadline={phase.deadline}
        signIn={signIn}
        onSignedIn={onSignedIn}
        onEnded={(message) => setPhase({ kind: "ended", message })}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {phase.kind === "ended" && (
        <p role="alert" className="rounded-control border border-status-failed px-3 py-2 text-label text-status-failed">
          {phase.message}
        </p>
      )}
      <button type="button" onClick={start} disabled={phase.kind === "starting"} className={PRIMARY}>
        {phase.kind === "starting" ? "Asking GitHub for a code..." : phase.kind === "ended" ? "Try again" : "Sign in with GitHub"}
      </button>
    </div>
  );
}

type WaitingProps = {
  code: DeviceCode;
  deadline: number;
  signIn: DeviceSignIn;
  onSignedIn: () => void;
  onEnded: (message: string) => void;
};

function WaitingForApproval({ code, deadline, signIn, onSignedIn, onEnded }: WaitingProps) {
  const [remaining, setRemaining] = useState(() => secondsUntil(deadline));
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const callbacks = useRef({ onSignedIn, onEnded });
  callbacks.current = { onSignedIn, onEnded };

  useEffect(() => {
    const tick = window.setInterval(() => setRemaining(secondsUntil(deadline)), 1000);
    return () => window.clearInterval(tick);
  }, [deadline]);

  useEffect(() => {
    let interval = code.interval;
    let timer = 0;
    let stopped = false;

    const check = async () => {
      if (stopped) return;
      if (Date.now() >= deadline) {
        callbacks.current.onEnded(ENDED.expired);
        return;
      }
      try {
        const status = await signIn.poll();
        if (stopped) return;
        if (status === "signed_in") return callbacks.current.onSignedIn();
        if (status === "expired" || status === "denied" || status === "no_cookie") return callbacks.current.onEnded(ENDED[status]);
        if (status === "slow_down") interval += SLOW_DOWN_SECONDS;
      } catch (cause) {
        if (!stopped) callbacks.current.onEnded(cause instanceof Error ? cause.message : "Sign-in stopped. Try again.");
        return;
      }
      timer = window.setTimeout(check, interval * 1000);
    };

    timer = window.setTimeout(check, interval * 1000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [code, deadline, signIn]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code.userCode);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  const left = formatRemaining(remaining);
  const share = code.expiresIn > 0 ? Math.min(100, (remaining / code.expiresIn) * 100) : 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="relative overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 py-4 pr-3 pl-5">
          <output aria-label="Sign-in code" className="select-all font-mono text-display font-semibold tracking-widest text-fg">
            {code.userCode}
          </output>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy the sign-in code"
            title="Copy"
            className="rounded-control p-2 text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            {copied === "copied" ? <Check aria-hidden="true" className="size-5 text-status-completed" /> : <Copy aria-hidden="true" className="size-5" />}
          </button>
        </div>
        <div
          role="progressbar"
          aria-label="Time left on the code"
          aria-valuemin={0}
          aria-valuemax={code.expiresIn}
          aria-valuenow={remaining}
          aria-valuetext={left}
          className="absolute inset-x-0 bottom-0 h-1 bg-surface-muted"
        >
          <svg aria-hidden="true" className="block h-full w-full" preserveAspectRatio="none">
            <rect width={`${share}%`} height="100%" className="fill-accent" />
          </svg>
        </div>
      </div>
      <p role="status" className="text-center text-caption text-fg-muted">
        {copied === "copied" ? "Code copied. " : copied === "failed" ? "Copy failed, select the code instead. " : ""}
      </p>
      <a href={code.verificationUri} target="_blank" rel="noreferrer" className={PRIMARY}>
        Open GitHub
      </a>
      <p aria-live="polite" className="text-center text-caption text-fg-muted">
        Waiting for approval... the code expires in {left}
      </p>
    </div>
  );
}

function secondsUntil(deadline: number): number {
  return Math.max(0, Math.round((deadline - Date.now()) / 1000));
}

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
