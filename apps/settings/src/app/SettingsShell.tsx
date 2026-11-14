import type { ReactNode } from "react";
import { SECTIONS, sectionFromHash, type SectionId } from "~/app/sections";
import { useLoadState, useReload } from "~/app/settings-context";
import { useHash } from "~/app/use-hash";
import { ThemeToggle } from "~/app/ThemeToggle";
import { SubscriptionPanel } from "~/features/subscription/SubscriptionPanel";
import { CloudAccessPanel } from "~/features/cloud/CloudAccessPanel";
import { GithubPanel } from "~/features/github/GithubPanel";
import { Button } from "~/ui/Button";
import { Notice } from "~/ui/Notice";
import { Spinner } from "~/ui/Spinner";

const panels: Record<SectionId, () => ReactNode> = {
  subscription: () => <SubscriptionPanel />,
  cloud: () => <CloudAccessPanel />,
  github: () => <GithubPanel />,
};

export function SettingsShell() {
  const active = sectionFromHash(useHash());
  const load = useLoadState();
  const reload = useReload();
  const company = load.kind === "ready" ? load.settings.account.company : null;
  const current = SECTIONS.find((section) => section.id === active)!;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" className="size-7 rounded-item" />
            <span className="type-heading">Infrared</span>
            {company && <span className="type-small hidden text-fg-muted sm:inline">/ {company}</span>}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 md:grid-cols-[13rem_minmax(0,1fr)] md:py-10">
        <div>
          <h1 className="type-title mb-4 md:mb-6">Settings</h1>
          <nav aria-label="Settings sections">
            <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
              {SECTIONS.map((section) => {
                const selected = section.id === active;
                return (
                  <li key={section.id} className="shrink-0">
                    <a
                      href={`#/${section.id}`}
                      aria-current={selected ? "page" : undefined}
                      className={`type-label block rounded-item px-3 py-2 transition ${selected ? "bg-accent-soft text-accent-ink" : "text-fg-muted hover:bg-sunken hover:text-fg"}`}
                    >
                      {section.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <main className="min-w-0">
          <div className="mb-5">
            <h2 className="type-heading">{current.label}</h2>
            <p className="type-body text-fg-muted">{current.summary}</p>
          </div>
          {load.kind === "loading" && (
            <div className="flex items-center gap-3 py-12 text-fg-muted">
              <Spinner label="Loading settings" /> Loading settings…
            </div>
          )}
          {load.kind === "failed" && (
            <Notice tone="danger">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Could not load settings: {load.message}</span>
                <Button onClick={reload}>Try again</Button>
              </div>
            </Notice>
          )}
          {load.kind === "ready" && <div className="flex flex-col gap-5">{panels[active]()}</div>}
        </main>
      </div>
    </div>
  );
}
