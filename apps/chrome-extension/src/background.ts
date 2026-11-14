import { loadLatest } from "~/domain/api";
import { noAccessNotice, noticeFor } from "~/domain/notice";
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
    return { run: null, notice: noticeFor(cause) };
  }

  if (!(await hasOrchestratorPermission(orchestratorUrl))) {
    return { run: null, notice: noAccessNotice(orchestratorUrl) };
  }

  if (
    !force &&
    cache &&
    cache.key === orchestratorUrl &&
    Date.now() - cache.at < CACHE_MS
  ) {
    return cache.response;
  }

  let response: LatestResponse;
  try {
    response = { run: await loadLatest(orchestratorUrl) };
  } catch (cause) {
    response = { run: null, notice: noticeFor(cause) };
  }
  cache = { at: Date.now(), key: orchestratorUrl, response };
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
