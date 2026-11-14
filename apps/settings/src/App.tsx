import { useMemo } from "react";
import { createFakeSettingsApi } from "~/adapters/fake-settings-api";
import { SettingsProvider } from "~/app/settings-context";
import { SettingsShell } from "~/app/SettingsShell";
import type { SettingsApi } from "~/ports/settings-api";

export function App({ api }: { api?: SettingsApi }) {
  const settingsApi = useMemo(() => api ?? createFakeSettingsApi(undefined, { delayMs: 600 }), [api]);
  return (
    <SettingsProvider api={settingsApi}>
      <SettingsShell />
    </SettingsProvider>
  );
}
