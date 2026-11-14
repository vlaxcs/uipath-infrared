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
  dashboardUrl: "http://localhost:5173",
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
  if (!isLocalOrchestratorUrl(normalized.orchestratorUrl)) {
    throw new Error("The orchestrator URL must be http://localhost or http://127.0.0.1.");
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
    typeof value.orchestratorUrl === "string" && isLocalOrchestratorUrl(value.orchestratorUrl)
      ? normalizeBaseUrl(value.orchestratorUrl)
      : DEFAULT_SETTINGS.orchestratorUrl;
  const dashboardUrl =
    typeof value.dashboardUrl === "string" && isHttpUrl(value.dashboardUrl)
      ? normalizeBaseUrl(value.dashboardUrl)
      : DEFAULT_SETTINGS.dashboardUrl;
  return { orchestratorUrl, dashboardUrl };
}
