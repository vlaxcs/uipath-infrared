import { AccountSettings, AccountSettingsPanel, type AccountSettingsSource } from "~/accountSettings/AccountSettings";

export function AccountPage({ accountSettings }: { accountSettings?: AccountSettingsSource }) {
  return (
    <section aria-label="Account" className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <h2 className="text-label font-semibold text-fg-muted">Subscription</h2>
      <AccountSettings source={accountSettings}>
        <AccountSettingsPanel panel="subscription" />
      </AccountSettings>
    </section>
  );
}
