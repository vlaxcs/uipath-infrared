import { Fact, PageHeader, PageSection } from "~/pages/PageSection";

export function AccountPage() {
  return (
    <section aria-labelledby="account-title" className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader id="account-title" title="Account" lead="Runs left, plan and payments." />
      <PageSection title="Runs">
        <dl className="flex flex-col gap-1">
          <Fact label="Left" value="Not tracked" />
          <Fact label="Plan" value="Run pack" />
        </dl>
      </PageSection>
      <PageSection title="Plans">
        <dl className="flex flex-col gap-1">
          <Fact label="Run pack" value="5 runs · 100 USD" />
          <Fact label="Subscription" value="200 USD / month · scheduled runs · not available" />
        </dl>
      </PageSection>
      <PageSection title="Payments">
        <p className="text-label text-fg-muted">No payments.</p>
      </PageSection>
    </section>
  );
}
