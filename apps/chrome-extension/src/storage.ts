declare const __DEFAULT_ORCHESTRATOR_URL__: string;

export type Settings = {
  orchestratorUrl: string;
  dashboardUrl: string;
};

export const DEFAULT_ORCHESTRATOR_URL =
  typeof __DEFAULT_ORCHESTRATOR_URL__ !== "undefined"
    ? __DEFAULT_ORCHESTRATOR_URL__
    : "http://127.0.0.1:8080";

export const DEFAULT_SETTINGS: Settings = {
  orchestratorUrl: DEFAULT_ORCHESTRATOR_URL,
  dashboardUrl: "http://127.0.0.1:5173/app",
};

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function isLocalOrchestratorUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function isRemoteOrchestratorUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function isSupportedOrchestratorUrl(value: string): boolean {
  return isLocalOrchestratorUrl(value) || isRemoteOrchestratorUrl(value);
}

export function orchestratorOriginPattern(value: string): string | null {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}/*`;
  } catch {
    return null;
  }
}

export async function hasOrchestratorPermission(value: string): Promise<boolean> {
  if (isLocalOrchestratorUrl(value)) return true;
  if (!isRemoteOrchestratorUrl(value)) return false;

  const pattern = orchestratorOriginPattern(value);
  if (!pattern || typeof chrome === "undefined" || !chrome.permissions) return false;
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(["orchestratorUrl", "dashboardUrl"]);
  return normalizeSettings(stored);
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const normalized: Settings = {
    orchestratorUrl: normalizeBaseUrl(settings.orchestratorUrl),
    dashboardUrl: normalizeBaseUrl(settings.dashboardUrl),
  };
  if (!isSupportedOrchestratorUrl(normalized.orchestratorUrl)) {
    throw new Error(
      "Use http://localhost or http://127.0.0.1 for a local demo, or an https:// URL for a hosted instance.",
    );
  }
  if (!isHttpUrl(normalized.dashboardUrl)) {
    throw new Error("The dashboard URL must be an http(s) URL.");
  }
  await chrome.storage.local.set(normalized);
  return normalized;
}

export function normalizeSettings(value: {
  orchestratorUrl?: unknown;
  dashboardUrl?: unknown;
}): Settings {
  const orchestratorUrl =
    typeof value.orchestratorUrl === "string" && isSupportedOrchestratorUrl(value.orchestratorUrl)
      ? normalizeBaseUrl(value.orchestratorUrl)
      : DEFAULT_SETTINGS.orchestratorUrl;
  const dashboardUrl =
    typeof value.dashboardUrl === "string" && isHttpUrl(value.dashboardUrl)
      ? normalizeBaseUrl(value.dashboardUrl)
      : DEFAULT_SETTINGS.dashboardUrl;
  return { orchestratorUrl, dashboardUrl };
}
