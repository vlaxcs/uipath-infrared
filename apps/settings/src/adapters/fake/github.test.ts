import { describe, expect, it } from "vitest";
import { FIXED_NOW, fakeApi } from "~/app/test-utils";
import { DISCONNECTED, GITHUB_PERMISSIONS } from "~/domain/github-rules";
import { SettingsError } from "~/domain/types";

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof SettingsError ? error.code : "not a SettingsError";
  }
  return undefined;
}

async function connectedApi() {
  const api = fakeApi();
  const { state } = await api.beginGithubInstall();
  await api.completeGithubInstall(state, 51234567);
  return api;
}

describe("the fake github api", () => {
  it("begins an install with a state carried in the install url", async () => {
    const api = fakeApi();
    const begin = await api.beginGithubInstall();
    expect(begin.state).toMatch(/^ghs_\d{4}$/);
    expect(begin.installUrl).toBe(`https://github.com/apps/infrared/installations/new?state=${begin.state}`);
  });

  it("completes the install for the pending state", async () => {
    const api = fakeApi();
    const { state } = await api.beginGithubInstall();
    const settings = await api.completeGithubInstall(state, 51234567);
    expect(settings.github).toEqual({
      status: "connected",
      org: "shopwave",
      installationId: 51234567,
      repoSelection: { kind: "all" },
      availableRepos: ["shopwave/storefront", "shopwave/checkout-api", "shopwave/infra", "shopwave/mobile-app", "shopwave/data-pipeline"],
      permissions: GITHUB_PERMISSIONS,
      installedAt: FIXED_NOW.toISOString(),
      extensionReady: true,
    });
  });

  it("rejects a state that does not match the pending one", async () => {
    const api = fakeApi();
    expect(await codeOf(api.completeGithubInstall("ghs_9999", 51234567))).toBe("install_state_mismatch");
    await api.beginGithubInstall();
    expect(await codeOf(api.completeGithubInstall("ghs_9999", 51234567))).toBe("install_state_mismatch");
    expect(api.store.state.github.status).toBe("not_connected");
  });

  it("only accepts the latest state, once", async () => {
    const api = fakeApi();
    const first = await api.beginGithubInstall();
    const second = await api.beginGithubInstall();
    expect(await codeOf(api.completeGithubInstall(first.state, 51234567))).toBe("install_state_mismatch");
    await api.completeGithubInstall(second.state, 51234567);
    expect(await codeOf(api.completeGithubInstall(second.state, 51234567))).toBe("install_state_mismatch");
  });

  it("rejects an invalid installation id and keeps the pending state", async () => {
    const api = fakeApi();
    const { state } = await api.beginGithubInstall();
    expect(await codeOf(api.completeGithubInstall(state, 0))).toBe("invalid_input");
    expect(await codeOf(api.completeGithubInstall(state, 2.5))).toBe("invalid_input");
    expect((await api.completeGithubInstall(state, 7)).github.installationId).toBe(7);
  });

  it("refuses a second begin while connected", async () => {
    const api = await connectedApi();
    expect(await codeOf(api.beginGithubInstall())).toBe("conflict");
  });

  it("refuses to begin while suspended", async () => {
    const api = fakeApi((seed) => {
      seed.github.status = "suspended";
    });
    expect(await codeOf(api.beginGithubInstall())).toBe("conflict");
  });

  it("validates and dedupes the repository selection", async () => {
    const api = await connectedApi();
    expect(await codeOf(api.updateRepoSelection({ kind: "selected", repos: [] }))).toBe("invalid_input");
    expect(await codeOf(api.updateRepoSelection({ kind: "selected", repos: ["shopwave/storefront", "evil/repo"] }))).toBe("invalid_input");
    const settings = await api.updateRepoSelection({ kind: "selected", repos: ["shopwave/infra", "shopwave/infra", "shopwave/storefront"] });
    expect(settings.github.repoSelection).toEqual({ kind: "selected", repos: ["shopwave/infra", "shopwave/storefront"] });
    expect(settings.github.extensionReady).toBe(true);
    expect((await api.updateRepoSelection({ kind: "all" })).github.repoSelection).toEqual({ kind: "all" });
  });

  it("refuses repository changes while not connected", async () => {
    expect(await codeOf(fakeApi().updateRepoSelection({ kind: "all" }))).toBe("conflict");
  });

  it("disconnects back to the default and allows a new install", async () => {
    const api = await connectedApi();
    expect((await api.disconnectGithub()).github).toEqual(DISCONNECTED);
    expect(await codeOf(api.disconnectGithub())).toBe("conflict");
    const { state } = await api.beginGithubInstall();
    expect((await api.completeGithubInstall(state, 51234567)).github.status).toBe("connected");
  });

  it("disconnects a suspended installation", async () => {
    const api = fakeApi((seed) => {
      seed.github = { ...seed.github, status: "suspended", org: "shopwave", installationId: 51234567 };
    });
    expect((await api.disconnectGithub()).github).toEqual(DISCONNECTED);
  });

  it("returns snapshots that do not alias the store", async () => {
    const api = await connectedApi();
    const settings = await api.updateRepoSelection({ kind: "selected", repos: ["shopwave/infra"] });
    settings.github.availableRepos.push("shopwave/extra");
    expect(api.store.state.github.availableRepos).toHaveLength(5);
  });
});
