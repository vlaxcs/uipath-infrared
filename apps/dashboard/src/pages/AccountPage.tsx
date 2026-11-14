import { AccountSettings, AccountSettingsPanel, type AccountSettingsSource } from "~/accountSettings/AccountSettings";
import { Fact, PageSection } from "~/pages/PageSection";

export function AccountPage({ accountSettings }: { accountSettings?: AccountSettingsSource }) {
  return (
    <section aria-label="Account" className="flex flex-col gap-4">
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
