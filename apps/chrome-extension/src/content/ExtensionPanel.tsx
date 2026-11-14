import { useCallback, useEffect, useState } from "react";
import type { LatestResponse } from "~/domain/types";
import { DEFAULT_SETTINGS, getSettings, type Settings } from "~/storage";
import { Panel } from "~/ui/Panel";

export function ExtensionPanel() {
  const [response, setResponse] = useState<LatestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (force: boolean) => {
    setLoading(true);
    try {
      const [nextSettings, stored] = await Promise.all([
        getSettings(),
        chrome.storage.local.get("collapsed"),
      ]);
      setSettings(nextSettings);
      setCollapsed(stored.collapsed === true);

      const latest = (await chrome.runtime.sendMessage({
        type: "latest",
        force,
      })) as LatestResponse | undefined;

      if (latest?.run) {
        setResponse(latest);
        setError(null);
      } else {
        setError("The extension background did not answer.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void request(false);
  }, [request]);

  useEffect(() => {
    if (collapsed) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void request(false);
    }, 10000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void request(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [collapsed, request]);

  const toggleCollapsed = async () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      await chrome.storage.local.set({ collapsed: next });
    } catch {
      // The card still works for this page session.
    }
  };

  const openOptions = () => {
    void chrome.runtime.sendMessage({ type: "open-options" });
  };

  return (
    <Panel
      run={response?.run ?? null}
      note={error ?? undefined}
      loading={loading}
      collapsed={collapsed}
      dashboardUrl={settings.dashboardUrl}
      onToggleCollapsed={() => void toggleCollapsed()}
      onRefresh={() => void request(true)}
      onOpenOptions={openOptions}
    />
  );
}
