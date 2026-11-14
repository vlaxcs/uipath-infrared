import { AccountSettings, AccountSettingsPanel, type AccountSettingsSource } from "~/accountSettings/AccountSettings";
import { Fact, PageHeader, PageSection } from "~/pages/PageSection";

export function AccountPage({ accountSettings }: { accountSettings?: AccountSettingsSource }) {
  return (
    <section aria-labelledby="account-title" className="flex flex-col gap-4">
      <PageHeader id="account-title" title="Account" lead="Runs left, plan and payments." />
      <PageSection title="Runs">
        <dl className="flex flex-col gap-1">
          <Fact label="Left" value="Not tracked" />
        </dl>
      </PageSection>
      <AccountSettings source={accountSettings}>
        <PageSection title="Subscription">
          <AccountSettingsPanel panel="subscription" />
        </PageSection>
      </AccountSettings>
    </section>
  );
}
