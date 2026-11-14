import { useEffect, useState, type FormEvent } from "react";
import {
  DEFAULT_SETTINGS,
  getSettings,
  isHttpUrl,
  isLocalOrchestratorUrl,
  isSupportedOrchestratorUrl,
  normalizeBaseUrl,
  orchestratorOriginPattern,
  saveSettings,
  type Settings,
} from "~/storage";

export function OptionsApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch((cause) => setError(messageOf(cause)))
      .finally(() => setLoaded(true));
  }, []);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const orchestratorUrl = normalizeBaseUrl(settings.orchestratorUrl);
    const dashboardUrl = normalizeBaseUrl(settings.dashboardUrl);

    if (!isSupportedOrchestratorUrl(orchestratorUrl)) {
      setError(
        "Use http://localhost or http://127.0.0.1 for a local demo, or an https:// URL for a hosted instance.",
      );
      return;
    }
    if (!isHttpUrl(dashboardUrl)) {
      setError("The dashboard URL must be an http(s) URL.");
      return;
    }

    if (!isLocalOrchestratorUrl(orchestratorUrl)) {
      const pattern = orchestratorOriginPattern(orchestratorUrl);
      if (!pattern) {
        setError("That orchestrator URL is not valid.");
        return;
      }
      let granted = false;
      try {
        granted = await chrome.permissions.request({ origins: [pattern] });
      } catch (cause) {
        setError(`Chrome could not ask for access: ${messageOf(cause)}`);
        return;
      }
      if (!granted) {
        setError(`Chrome did not grant access to ${hostOf(orchestratorUrl)}.`);
        return;
      }
    }

    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${orchestratorUrl}/runs?limit=1`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const runs = (await response.json()) as unknown[];
      const saved = await saveSettings({ orchestratorUrl, dashboardUrl });
      setSettings(saved);
      setMessage(
        `Connected — ${runs.length} run${runs.length === 1 ? "" : "s"} found. Settings saved.`,
      );
    } catch (cause) {
      setError(`Could not reach the orchestrator: ${messageOf(cause)}`);
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  const useLocalDemo = async () => {
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      setSettings(await saveSettings(DEFAULT_SETTINGS));
      setMessage("Using the local demo at http://127.0.0.1:8080.");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="options">
      <header>
        <h1>Connect Infrared</h1>
        <p className="lede">
          The latest run and GitHub Actions runner suggestions, shown in a card on GitHub pages.
        </p>
      </header>

      {!loaded ? (
        <p role="status" className="status">
          Loading settings…
        </p>
      ) : (
        <form onSubmit={connect}>
        <div className="field">
          <label htmlFor="orchestrator-url">Orchestrator URL</label>
          <input
            id="orchestrator-url"
            type="url"
            value={settings.orchestratorUrl}
            onChange={(event) =>
              setSettings({ ...settings, orchestratorUrl: event.target.value })
            }
            placeholder="https://infrared.example.com"
            aria-describedby="orchestrator-hint"
          />
          <span id="orchestrator-hint" className="field-hint">
            Local demo: http://127.0.0.1:8080. Hosted: an https:// URL; Chrome asks for access
            to that host.
          </span>
        </div>

        <div className="field">
          <label htmlFor="dashboard-url">Dashboard URL</label>
          <input
            id="dashboard-url"
            type="url"
            value={settings.dashboardUrl}
            onChange={(event) => setSettings({ ...settings, dashboardUrl: event.target.value })}
            placeholder="http://localhost:5173"
            aria-describedby="dashboard-hint"
          />
          <span id="dashboard-hint" className="field-hint">
            Used by the card's Open dashboard link.
          </span>
        </div>

        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>
            Connect
          </button>
          <button type="button" onClick={() => void useLocalDemo()} disabled={busy}>
            Use local demo
          </button>
        </div>
      </form>
      )}

      {message ? (
        <p role="status" className="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}

      <p className="hint">
        The card is read-only: approvals happen in the dashboard. A hosted orchestrator must be
        reachable over HTTPS; authentication and the GitHub token stay on the server.
      </p>
    </main>
  );
}

function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
