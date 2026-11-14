import { useEffect, useId, useState, type FormEvent } from "react";
import { OrchestratorError, orchestratorOnboarding, type OnboardingSource } from "~/onboarding/api";
import { CriteriaFields } from "~/onboarding/CriteriaFields";
import type { Profile, ProfileSite } from "~/onboarding/types";
import { Fact, PageHeader, PageSection } from "~/pages/PageSection";

type State = { status: "loading" } | { status: "failed"; reason: string } | { status: "ready"; profile: Profile };

const INPUT = "rounded-control border border-border bg-surface px-3 py-2 text-label text-fg";

function reasonOf(error: unknown): string {
  return error instanceof OrchestratorError ? error.message : "Something went wrong. Try again.";
}

const NEW_SITE: ProfileSite = { kind: "search", label: "", lat: 44.4268, lng: 26.1025, radius_km: 25 };

export function ConfigurationPage({ source = orchestratorOnboarding }: { source?: OnboardingSource }) {
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
    <section aria-labelledby="configuration-title" className="flex flex-col gap-4">
      <PageHeader id="configuration-title" title="Configuration" lead="Connections and the defaults every new analysis starts from." />
      <PageSection title="GitHub organisation">
        <dl className="flex flex-col gap-1">
          <Fact label="Organisation" value="Not connected" />
        </dl>
        <p className="text-caption text-fg-subtle">Connected with GitHub sign-in.</p>
      </PageSection>
      <PageSection title="Infrastructure">
        <dl className="flex flex-col gap-1">
          <Fact label="Provider" value="AWS" />
          <Fact label="Account" value="Demo estate on Floci" />
        </dl>
        <p className="text-caption text-fg-subtle">Reached with the orchestrator&apos;s credentials. No cloud credentials pass through the browser.</p>
      </PageSection>

      {state.status === "loading" ? (
        <p role="status" className="text-label text-fg-muted">Loading the defaults</p>
      ) : state.status === "failed" ? (
        <p role="alert" className="text-label text-status-failed">{state.reason}</p>
      ) : (
        <form aria-label="Defaults" onSubmit={save} className="flex flex-col gap-4">
          <PageSection title="Project defaults">
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

function SiteFields({ id, site, onChange }: { id: string; site: ProfileSite; onChange: (site: ProfileSite) => void }) {
  const number = (value: string) => (value === "" ? NaN : Number(value));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <fieldset className="flex flex-col gap-1 md:col-span-2">
        <legend className="text-label font-medium text-fg">Site</legend>
        {(["search", "headquarters"] as const).map((kind) => (
          <label key={kind} className="flex items-center gap-2 text-label text-fg">
            <input
              type="radio"
              name={`${id}-kind`}
              checked={site.kind === kind}
              onChange={() =>
                onChange(kind === "search" ? { ...site, kind, radius_km: site.radius_km ?? 25, free_area_m2: undefined } : { ...site, kind, free_area_m2: site.free_area_m2 ?? 100, radius_km: undefined })
              }
              className="accent-accent"
            />
            {kind === "search" ? "Find a space near" : "At our headquarters"}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-label text-fg md:col-span-2">
        Address
        <input value={site.label} onChange={(event) => onChange({ ...site, label: event.target.value })} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-label text-fg">
        Latitude
        <input type="number" step="any" value={site.lat} onChange={(event) => onChange({ ...site, lat: number(event.target.value) })} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-label text-fg">
        Longitude
        <input type="number" step="any" value={site.lng} onChange={(event) => onChange({ ...site, lng: number(event.target.value) })} className={INPUT} />
      </label>
      {site.kind === "search" ? (
        <label className="flex flex-col gap-1 text-label text-fg">
          Radius, km (5 to 100)
          <input type="number" min={5} max={100} value={site.radius_km ?? ""} onChange={(event) => onChange({ ...site, radius_km: number(event.target.value) })} className={INPUT} />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-label text-fg">
          Free floor area, m²
          <input type="number" min={1} value={site.free_area_m2 ?? ""} onChange={(event) => onChange({ ...site, free_area_m2: number(event.target.value) })} className={INPUT} />
        </label>
      )}
    </div>
  );
}
