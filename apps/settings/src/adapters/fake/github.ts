import type { GithubApi } from "~/ports/settings-api";
import type { FakeStore } from "~/adapters/fake/store";
import { assertCanBegin, connect, disconnect, selectRepos } from "~/domain/github-rules";
import { SettingsError } from "~/domain/types";

export const FAKE_GITHUB_ORG = "shopwave";

export const FAKE_GITHUB_REPOS = [
  "shopwave/storefront",
  "shopwave/checkout-api",
  "shopwave/infra",
  "shopwave/mobile-app",
  "shopwave/data-pipeline",
];

export function createFakeGithubApi(store: FakeStore): GithubApi {
  let pendingState: string | null = null;

  return {
    beginGithubInstall: () =>
      store.settle(() => {
        assertCanBegin(store.state.github);
        const state = store.nextId("ghs");
        pendingState = state;
        return { state, org: FAKE_GITHUB_ORG, repos: [...FAKE_GITHUB_REPOS], installUrl: `https://github.com/apps/infrared/installations/new?state=${encodeURIComponent(state)}` };
      }),

    completeGithubInstall: (state, installationId) =>
      store.settle(() => {
        if (pendingState === null || state !== pendingState) {
          throw new SettingsError("install_state_mismatch", "The install session expired or does not match. Start the connection again.");
        }
        store.state.github = connect(store.state.github, {
          org: FAKE_GITHUB_ORG,
          installationId,
          availableRepos: FAKE_GITHUB_REPOS,
          installedAt: store.now().toISOString(),
        });
        pendingState = null;
        return store.snapshot();
      }),

    updateRepoSelection: (selection) =>
      store.settle(() => {
        store.state.github = selectRepos(store.state.github, selection);
        return store.snapshot();
      }),

    disconnectGithub: () =>
      store.settle(() => {
        store.state.github = disconnect(store.state.github);
        pendingState = null;
        return store.snapshot();
      }),
  };
}
