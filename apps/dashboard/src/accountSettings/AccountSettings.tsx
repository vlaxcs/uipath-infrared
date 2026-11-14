import type { ReactNode } from "react";
import { createFakeSettingsApi } from "../../../settings/src/adapters/fake-settings-api";
import { SettingsProvider, useLoadState, useReload } from "../../../settings/src/app/settings-context";
import { CloudAccessPanel } from "../../../settings/src/features/cloud/CloudAccessPanel";
import { GithubPanel } from "../../../settings/src/features/github/GithubPanel";
import { SubscriptionPanel } from "../../../settings/src/features/subscription/SubscriptionPanel";
import type { SandboxControls } from "../../../settings/src/ports/billing";
import type { SettingsApi } from "../../../settings/src/ports/settings-api";
import { Button } from "../../../settings/src/ui/Button";
import { Notice } from "../../../settings/src/ui/Notice";
import { Spinner } from "../../../settings/src/ui/Spinner";

const simulated = createFakeSettingsApi(undefined, { delayMs: 300 });

export type AccountSettingsSource = { api: SettingsApi; sandbox: SandboxControls | null };

export const simulatedAccountSettings: AccountSettingsSource = { api: simulated, sandbox: simulated.sandbox };

const PANELS = {
  github: GithubPanel,
  cloud: CloudAccessPanel,
  subscription: SubscriptionPanel,
} as const;

export type AccountPanel = keyof typeof PANELS;

export function AccountSettings({ source = simulatedAccountSettings, children }: { source?: AccountSettingsSource; children: ReactNode }) {
  return (
    <SettingsProvider api={source.api} sandbox={source.sandbox}>
      {children}
    </SettingsProvider>
  );
}

export function AccountSettingsPanel({ panel }: { panel: AccountPanel }) {
  const load = useLoadState();
  const reload = useReload();
  const Panel = PANELS[panel];
  if (load.kind === "loading") {
    return (
      <div className="flex items-center gap-3 text-label text-fg-muted">
        <Spinner label="Loading account settings" /> Loading account settings
      </div>
    );
  }
  if (load.kind === "failed") {
    return (
      <Notice tone="danger">
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>Could not load account settings: {load.message}</span>
          <Button onClick={reload}>Try again</Button>
        </span>
      </Notice>
    );
  }
  return <Panel />;
}
