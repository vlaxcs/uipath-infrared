import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_SETTINGS,
  getSettings,
  isHttpUrl,
  isLocalOrchestratorUrl,
  normalizeBaseUrl,
  saveSettings,
  type Settings,
} from "~/storage";

export function OptionsApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch((cause) => setError(messageOf(cause)));
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!isLocalOrchestratorUrl(settings.orchestratorUrl)) {
      setError("The orchestrator URL must point at http://localhost or http://127.0.0.1.");
      return;
    }
    if (!isHttpUrl(settings.dashboardUrl)) {
      setError("The dashboard URL must be an http(s) URL.");
      return;
    }

    setBusy(true);
    try {
      setSettings(await saveSettings(settings));
      setMessage("Saved.");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setMessage(null);
    setError(null);

    if (!isLocalOrchestratorUrl(settings.orchestratorUrl)) {
      setError("The orchestrator URL must point at http://localhost or http://127.0.0.1.");
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${normalizeBaseUrl(settings.orchestratorUrl)}/runs?limit=1`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const runs = (await response.json()) as unknown[];
      setMessage(`Connected — ${runs.length} run${runs.length === 1 ? "" : "s"} found.`);
    } catch (cause) {
      setError(`Could not reach the orchestrator: ${messageOf(cause)}`);
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  return (
    <main className="options">
      <header>
        <h1>Infrared</h1>
        <p className="lede">
          The latest run and GitHub Actions runner suggestions, shown in a card on GitHub pages.
        </p>
      </header>

      <form onSubmit={save}>
        <label>
          Orchestrator URL
          <input
            type="url"
            value={settings.orchestratorUrl}
            onChange={(event) =>
              setSettings({ ...settings, orchestratorUrl: event.target.value })
            }
            placeholder="http://127.0.0.1:8080"
          />
        </label>
        <label>
          Dashboard URL
          <input
            type="url"
            value={settings.dashboardUrl}
            onChange={(event) => setSettings({ ...settings, dashboardUrl: event.target.value })}
            placeholder="http://localhost:5173"
          />
        </label>
        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>
            Save
          </button>
          <button type="button" onClick={() => void test()} disabled={busy}>
            Test connection
          </button>
        </div>
      </form>

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
        The card is read-only: approvals happen in the dashboard. Runner suggestions are derived from
        the run's <code>infra.json</code> GitHub Actions usage and are not priced by the engine.
      </p>
    </main>
  );
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<OptionsApp />);
