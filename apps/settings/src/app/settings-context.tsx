import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AccountSettings } from "~/domain/types";
import { SettingsError } from "~/domain/types";
import type { SettingsApi } from "~/ports/settings-api";
import type { SandboxControls } from "~/ports/billing";

type LoadState = { kind: "loading" } | { kind: "ready"; settings: AccountSettings } | { kind: "failed"; message: string };

interface SettingsContextValue {
  api: SettingsApi;
  sandbox: SandboxControls | null;
  load: LoadState;
  apply(settings: AccountSettings): void;
  reload(): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ api, sandbox = null, children }: { api: SettingsApi; sandbox?: SandboxControls | null; children: ReactNode }) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad({ kind: "loading" });
    api.getSettings().then(
      (settings) => live && setLoad({ kind: "ready", settings }),
      (error: unknown) => live && setLoad({ kind: "failed", message: messageOf(error) }),
    );
    return () => {
      live = false;
    };
  }, [api, attempt]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      api,
      sandbox,
      load,
      apply: (settings) => setLoad({ kind: "ready", settings }),
      reload: () => setAttempt((n) => n + 1),
    }),
    [api, sandbox, load],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function useSettingsContext(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("SettingsProvider is missing");
  return value;
}

export function useLoadState(): LoadState {
  return useSettingsContext().load;
}

/** The Stripe test-mode controls, when the page runs on the simulator; null against a real API. */
export function useSandbox(): SandboxControls | null {
  return useSettingsContext().sandbox;
}

export function useReload(): () => void {
  return useSettingsContext().reload;
}

export function useSettings(): AccountSettings {
  const { load } = useSettingsContext();
  if (load.kind !== "ready") throw new Error("settings are not loaded yet");
  return load.settings;
}

export interface Action<A extends unknown[], R> {
  run(...args: A): Promise<R | undefined>;
  pending: boolean;
  error: string | null;
  clearError(): void;
}

export function useAction<A extends unknown[], R>(fn: (api: SettingsApi, ...args: A) => Promise<R>): Action<A, R> {
  const { api, apply } = useSettingsContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: A) => {
      setPending(true);
      setError(null);
      try {
        const result = await fn(api, ...args);
        if (isAccountSettings(result)) apply(result);
        return result;
      } catch (caught) {
        setError(messageOf(caught));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [api, apply, fn],
  );

  return { run, pending, error, clearError: useCallback(() => setError(null), []) };
}

function isAccountSettings(value: unknown): value is AccountSettings {
  return typeof value === "object" && value !== null && "account" in value && "subscription" in value;
}

export function messageOf(error: unknown): string {
  if (error instanceof SettingsError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
