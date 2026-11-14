import { useEffect, useId, useState, type FormEvent } from "react";
import { OrchestratorError, orchestratorOnboarding, type OnboardingSource } from "~/onboarding/api";
import { CriteriaFields } from "~/onboarding/CriteriaFields";
import { NEW_SITE, SiteFields } from "~/onboarding/SiteFields";
import type { Profile } from "~/onboarding/types";
import { AccountSettings, AccountSettingsPanel, type AccountSettingsSource } from "~/accountSettings/AccountSettings";
import { PageSection } from "~/pages/PageSection";

type State = { status: "loading" } | { status: "failed"; reason: string } | { status: "ready"; profile: Profile };


function reasonOf(error: unknown): string {
  return error instanceof OrchestratorError ? error.message : "Something went wrong. Try again.";
}


type ConfigurationPageProps = { source?: OnboardingSource; accountSettings?: AccountSettingsSource };

export function ConfigurationPage({ source = orchestratorOnboarding, accountSettings }: ConfigurationPageProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const id = useId();

  useEffect(() => {
    let current = true;
    source.loadProfile().then(
      (profile) => current && setState({ status: "ready", profile }),
      (error: unknown) => current && setState({ status: "failed", reason: reasonOf(error) }),
    );
    return () => {
      current = false;
    };
  }, [source]);

  const update = (profile: Profile) => {
    setState({ status: "ready", profile });
    setNotice(null);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (state.status !== "ready") return;
    setSaving(true);
    source
      .saveProfile(state.profile)
      .then(
        (saved) => {
          setState({ status: "ready", profile: saved });
          setNotice({ ok: true, text: "Saved. New analyses start from these defaults." });
        },
        (error: unknown) => setNotice({ ok: false, text: reasonOf(error) }),
      )
      .finally(() => setSaving(false));
  };

  return (
    <section aria-label="Configuration" className="flex flex-col gap-4">
      <AccountSettings source={accountSettings}>
        <PageSection title="GitHub organisation">
          <AccountSettingsPanel panel="github" />
        </PageSection>
        <PageSection title="Cloud access">
          <AccountSettingsPanel panel="cloud" />
        </PageSection>
      </AccountSettings>

      {state.status === "loading" ? (
        <p role="status" className="text-label text-fg-muted">Loading the defaults</p>
      ) : state.status === "failed" ? (
        <p role="alert" className="text-label text-status-failed">{state.reason}</p>
      ) : (
        <form aria-label="Defaults" onSubmit={save} className="flex flex-col gap-4">
          <PageSection title="Default focus">
            <CriteriaFields criteria={state.profile.criteria} onChange={(criteria) => update({ ...state.profile, criteria })} />
          </PageSection>
          <PageSection title="On-prem">
            <label className="flex items-center gap-2 text-label text-fg">
              <input
                type="checkbox"
                checked={state.profile.onprem.wanted}
                onChange={(event) =>
                  update({
                    ...state.profile,
                    onprem: event.target.checked ? { wanted: true, site: state.profile.onprem.site ?? NEW_SITE } : { wanted: false, site: state.profile.onprem.site },
                  })
                }
                className="accent-accent"
              />
              Also price a setup of our own
            </label>
            {state.profile.onprem.wanted && state.profile.onprem.site ? (
              <SiteFields id={id} site={state.profile.onprem.site} onChange={(site) => update({ ...state.profile, onprem: { wanted: true, site } })} />
            ) : null}
          </PageSection>
          <div className="flex flex-col items-start gap-2">
            <button type="submit" disabled={saving} aria-busy={saving} className="rounded-pill bg-accent px-5 py-2 text-label font-semibold text-on-accent disabled:opacity-50">
              {saving ? "Saving" : "Save defaults"}
            </button>
            {notice ? (
              <p role={notice.ok ? "status" : "alert"} className={`text-label ${notice.ok ? "text-status-completed" : "text-status-failed"}`}>
                {notice.text}
              </p>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
