import { SettingsError, type GithubInstallation, type GithubPermission, type RepoSelection } from "~/domain/types";

export const GITHUB_PERMISSIONS: GithubPermission[] = [
  { scope: "actions", access: "read", reason: "See workflow runs and runners" },
  { scope: "metadata", access: "read", reason: "List repositories" },
  { scope: "pull_requests", access: "write", reason: "Open migration pull requests (phase 2)" },
  { scope: "contents", access: "read", reason: "Read workflow files to suggest runners" },
];

export const DISCONNECTED: GithubInstallation = {
  status: "not_connected",
  org: null,
  installationId: null,
  repoSelection: { kind: "all" },
  availableRepos: [],
  permissions: [],
  installedAt: null,
  extensionReady: false,
};

export interface ConnectInput {
  org: string;
  installationId: number;
  availableRepos: string[];
  installedAt: string;
}

export function assertCanBegin(current: GithubInstallation): void {
  if (current.status === "connected") throw new SettingsError("conflict", "This GitHub organisation is already connected.");
  if (current.status === "suspended") throw new SettingsError("conflict", "The Infrared app is suspended in GitHub. Unsuspend it there first.");
}

export function connect(current: GithubInstallation, input: ConnectInput): GithubInstallation {
  assertCanBegin(current);
  if (!Number.isInteger(input.installationId) || input.installationId <= 0) {
    throw new SettingsError("invalid_input", "The installation ID must be a positive integer.");
  }
  return {
    status: "connected",
    org: input.org,
    installationId: input.installationId,
    repoSelection: { kind: "all" },
    availableRepos: [...input.availableRepos],
    permissions: GITHUB_PERMISSIONS.map((permission) => ({ ...permission })),
    installedAt: input.installedAt,
    extensionReady: true,
  };
}

export function selectRepos(current: GithubInstallation, selection: RepoSelection): GithubInstallation {
  if (current.status !== "connected") throw new SettingsError("conflict", "Connect a GitHub organisation before changing repository access.");
  if (selection.kind === "all") return { ...current, repoSelection: { kind: "all" }, extensionReady: true };
  const repos = [...new Set(selection.repos)];
  if (repos.length === 0) throw new SettingsError("invalid_input", "Select at least one repository.");
  const unknown = repos.filter((repo) => !current.availableRepos.includes(repo));
  if (unknown.length > 0) throw new SettingsError("invalid_input", `Unknown repository: ${unknown.join(", ")}.`);
  return { ...current, repoSelection: { kind: "selected", repos }, extensionReady: true };
}

export function disconnect(current: GithubInstallation): GithubInstallation {
  if (current.status === "not_connected") throw new SettingsError("conflict", "No GitHub organisation is connected.");
  return structuredClone(DISCONNECTED);
}

export function repoAccessSummary(installation: GithubInstallation): string {
  const total = installation.availableRepos.length;
  if (installation.repoSelection.kind === "all") return `All ${total} ${total === 1 ? "repository" : "repositories"}`;
  return `${installation.repoSelection.repos.length} of ${total} ${total === 1 ? "repository" : "repositories"}`;
}
