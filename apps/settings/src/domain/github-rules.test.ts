import { describe, expect, it } from "vitest";
import {
  assertCanBegin,
  connect,
  DISCONNECTED,
  disconnect,
  GITHUB_PERMISSIONS,
  repoAccessSummary,
  selectRepos,
} from "~/domain/github-rules";
import { SettingsError, type GithubInstallation } from "~/domain/types";

const REPOS = ["acme/web", "acme/api", "acme/infra"];
const input = { org: "acme", installationId: 42, availableRepos: REPOS, installedAt: "2026-11-14T12:00:00.000Z" };

function connected(): GithubInstallation {
  return connect(DISCONNECTED, input);
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof SettingsError ? error.code : "not a SettingsError";
  }
  return undefined;
}

describe("github rules", () => {
  it("requests four permissions with only pull requests as write", () => {
    expect(GITHUB_PERMISSIONS.map((p) => `${p.scope}:${p.access}`)).toEqual([
      "actions:read",
      "metadata:read",
      "pull_requests:write",
      "contents:read",
    ]);
  });

  it("connects with all repositories and a ready extension", () => {
    const next = connected();
    expect(next).toMatchObject({
      status: "connected",
      org: "acme",
      installationId: 42,
      repoSelection: { kind: "all" },
      availableRepos: REPOS,
      permissions: GITHUB_PERMISSIONS,
      installedAt: input.installedAt,
      extensionReady: true,
    });
  });

  it("rejects a non positive or fractional installation id", () => {
    expect(codeOf(() => connect(DISCONNECTED, { ...input, installationId: 0 }))).toBe("invalid_input");
    expect(codeOf(() => connect(DISCONNECTED, { ...input, installationId: -3 }))).toBe("invalid_input");
    expect(codeOf(() => connect(DISCONNECTED, { ...input, installationId: 1.5 }))).toBe("invalid_input");
  });

  it("refuses to begin or connect when already connected or suspended", () => {
    expect(codeOf(() => assertCanBegin(connected()))).toBe("conflict");
    expect(codeOf(() => connect(connected(), input))).toBe("conflict");
    expect(codeOf(() => assertCanBegin({ ...connected(), status: "suspended" }))).toBe("conflict");
    expect(codeOf(() => assertCanBegin(DISCONNECTED))).toBeUndefined();
  });

  it("selects a deduped subset of repositories", () => {
    const next = selectRepos(connected(), { kind: "selected", repos: ["acme/api", "acme/web", "acme/api"] });
    expect(next.repoSelection).toEqual({ kind: "selected", repos: ["acme/api", "acme/web"] });
    expect(next.extensionReady).toBe(true);
  });

  it("goes back to all repositories", () => {
    const narrowed = selectRepos(connected(), { kind: "selected", repos: ["acme/api"] });
    expect(selectRepos(narrowed, { kind: "all" }).repoSelection).toEqual({ kind: "all" });
  });

  it("rejects an empty or unknown selection", () => {
    expect(codeOf(() => selectRepos(connected(), { kind: "selected", repos: [] }))).toBe("invalid_input");
    expect(codeOf(() => selectRepos(connected(), { kind: "selected", repos: ["acme/web", "other/repo"] }))).toBe("invalid_input");
  });

  it("only changes repositories while connected", () => {
    expect(codeOf(() => selectRepos(DISCONNECTED, { kind: "all" }))).toBe("conflict");
    expect(codeOf(() => selectRepos({ ...connected(), status: "suspended" }, { kind: "all" }))).toBe("conflict");
  });

  it("disconnects a connected or suspended installation", () => {
    expect(disconnect(connected())).toEqual(DISCONNECTED);
    expect(disconnect({ ...connected(), status: "suspended" })).toEqual(DISCONNECTED);
    expect(codeOf(() => disconnect(DISCONNECTED))).toBe("conflict");
  });

  it("summarises repository access", () => {
    expect(repoAccessSummary(connected())).toBe("All 3 repositories");
    expect(repoAccessSummary(selectRepos(connected(), { kind: "selected", repos: ["acme/api", "acme/web"] }))).toBe("2 of 3 repositories");
  });
});
