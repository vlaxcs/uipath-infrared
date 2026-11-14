import { loadLatest } from "~/domain/api";
import { sampleLatestRun } from "~/domain/sample";
import type { LatestResponse } from "~/domain/types";
import { getSettings, hasOrchestratorPermission } from "~/storage";

const CACHE_MS = 5000;

let cache: { at: number; key: string; response: LatestResponse } | null = null;

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isRecord(message) || typeof message.type !== "string") return false;

  if (message.type === "latest") {
    void latest(Boolean(message.force)).then(sendResponse);
    return true;
  }

  if (message.type === "open-options") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

async function latest(force: boolean): Promise<LatestResponse> {
  let orchestratorUrl: string;

  try {
    orchestratorUrl = (await getSettings()).orchestratorUrl;
  } catch (cause) {
    return fallback(cause);
  }

  if (!(await hasOrchestratorPermission(orchestratorUrl))) {
    return fallback(
      new Error(
        `No access to ${hostOf(orchestratorUrl)}. Open Settings and connect Infrared.`,
      ),
    );
  }

  if (
    !force &&
    cache &&
    cache.key === orchestratorUrl &&
    Date.now() - cache.at < CACHE_MS
  ) {
    return cache.response;
  }

  try {
    const response = { run: await loadLatest(orchestratorUrl) };
    cache = { at: Date.now(), key: orchestratorUrl, response };
    return response;
  } catch (cause) {
    const response = fallback(cause);
    cache = { at: Date.now(), key: orchestratorUrl, response };
    return response;
  }
}

function fallback(cause: unknown): LatestResponse {
  const detail = cause instanceof Error ? cause.message : String(cause);
  const run = sampleLatestRun();
  return {
    run: {
      ...run,
      note: `Orchestrator unavailable (${detail}); showing sample data.`,
    },
  };
}

function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return "the orchestrator";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
