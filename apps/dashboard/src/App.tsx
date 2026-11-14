import { createHttpAccountSource, sampleAccountSource, type AccountSource } from "~/account/accountSource";
import { useAccount } from "~/account/useAccount";
import { HomePage } from "~/home/HomePage";
import { useHashRoute } from "~/navigation/useHashRoute";
import { AccountPage } from "~/pages/AccountPage";
import { AnalyzePage } from "~/pages/AnalyzePage";
import { ConfigurationPage } from "~/pages/ConfigurationPage";
import { LoginPage } from "~/pages/LoginPage";
import { runSource } from "~/runs/runSource";
import { RunsSection } from "~/runs/RunsSection";
import { settings } from "~/runs/settings";
import type { RunSource } from "~/runs/source";
import { Frame } from "~/shell/Frame";

type AppProps = {
  source?: RunSource;
  accountSource?: AccountSource;
  orchestratorUrl?: string | null;
  extensionUrl?: string | null;
};

const defaultAccountSource = settings.orchestratorUrl ? createHttpAccountSource(settings.orchestratorUrl) : sampleAccountSource;

export function App({
  source = runSource,
  accountSource = defaultAccountSource,
  orchestratorUrl = settings.orchestratorUrl,
  extensionUrl = settings.extensionUrl,
}: AppProps = {}) {
  const route = useHashRoute();
  const account = useAccount(accountSource);

  if (route.page === "login") {
    return <LoginPage orchestratorUrl={orchestratorUrl} onContinue={() => route.go("home")} />;
  }

  return (
    <Frame
      showBack={route.page !== "home"}
      account={account}
      onBack={route.back}
      onHome={() => route.go("home")}
      onNavigate={route.go}
      onDisconnect={() => route.go("login")}
    >
      {route.page === "home" ? (
        <HomePage extensionUrl={extensionUrl} onAnalyze={() => route.go("analyze")} onPrevious={() => route.go("runs")} />
      ) : route.page === "analyze" ? (
        <AnalyzePage onFollowRun={route.openRun} />
      ) : route.page === "runs" ? (
        <div className="w-full">
          <RunsSection
            source={source}
            runId={route.runId}
            focusGate={route.focusGate}
            onOpenRun={route.openRun}
          />
        </div>
      ) : route.page === "configuration" ? (
        <ConfigurationPage />
      ) : (
        <AccountPage />
      )}
    </Frame>
  );
}
