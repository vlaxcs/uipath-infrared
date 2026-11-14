import { useMemo } from "react";
import { createFakeSettingsApi } from "~/adapters/fake-settings-api";
import { SettingsProvider } from "~/app/settings-context";
import { SettingsShell } from "~/app/SettingsShell";
import type { SandboxControls } from "~/ports/billing";
import type { SettingsApi } from "~/ports/settings-api";

export function App({ api, sandbox }: { api?: SettingsApi; sandbox?: SandboxControls }) {
  const [settingsApi, sandboxControls] = useMemo(() => {
    if (api) return [api, sandbox ?? null] as const;
    const fake = createFakeSettingsApi(undefined, { delayMs: 600 });
    return [fake, fake.sandbox] as const;
  }, [api, sandbox]);
  return (
    <SettingsProvider api={settingsApi} sandbox={sandboxControls}>
      <SettingsShell />
    </SettingsProvider>
  );
}
