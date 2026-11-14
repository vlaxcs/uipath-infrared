import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createFakeSettingsApi, type FakeSettingsApi } from "~/adapters/fake-settings-api";
import { SEED_SETTINGS } from "~/adapters/seed";
import { SettingsProvider, useLoadState } from "~/app/settings-context";
import type { AccountSettings } from "~/domain/types";

export const FIXED_NOW = new Date("2026-11-14T12:00:00Z");

export function fakeApi(patch: (seed: AccountSettings) => void = () => {}): FakeSettingsApi {
  const seed = structuredClone(SEED_SETTINGS);
  patch(seed);
  return createFakeSettingsApi(seed, { now: () => FIXED_NOW });
}

function WhenReady({ children }: { children: ReactNode }) {
  return useLoadState().kind === "ready" ? <div data-testid="settings-ready">{children}</div> : null;
}

export async function renderWithApi(ui: ReactNode, api: FakeSettingsApi = fakeApi()) {
  const result = render(
    <SettingsProvider api={api} sandbox={api.sandbox}>
      <WhenReady>{ui}</WhenReady>
    </SettingsProvider>,
  );
  await screen.findByTestId("settings-ready");
  return { ...result, api };
}
