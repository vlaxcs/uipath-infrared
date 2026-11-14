import { useState } from "react";
import { createHttpAccountSource, sampleAccountSource, type AccountSource } from "~/account/accountSource";
import { useAccount } from "~/account/useAccount";
import { HomePage } from "~/home/HomePage";
import type { PageId } from "~/navigation/route";
import { useRoute } from "~/navigation/useRoute";
import { AccountPage } from "~/pages/AccountPage";
import { AnalyzePage } from "~/pages/AnalyzePage";
import { ConfigurationPage } from "~/pages/ConfigurationPage";
import { LoginPage } from "~/pages/LoginPage";
import { runSource } from "~/runs/runSource";
import { RunsSection } from "~/runs/RunsSection";
import { settings } from "~/runs/settings";
import type { RunSource } from "~/runs/source";
import { Frame } from "~/shell/Frame";
import { RefreshProvider } from "~/ui/refreshSignal";

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
  const route = useRoute();
  const account = useAccount(accountSource);
  const [refreshes, setRefreshes] = useState(0);

  if (route.page === "login") {
    return <LoginPage orchestratorUrl={orchestratorUrl} onContinue={() => route.go("home")} />;
  }

  return (
    <Frame
      showBack={route.page !== "home"}
      title={pageTitle(route.page, route.runId)}
      account={account}
      onBack={route.back}
      onHome={() => route.go("home")}
      onNavigate={route.go}
      onDisconnect={() => route.go("login")}
      onRefresh={() => setRefreshes((count) => count + 1)}
    >
      <RefreshProvider value={refreshes}>
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
      </RefreshProvider>
    </Frame>
  );
}

function pageTitle(page: PageId, runId: string | null): string | null {
  if (page === "analyze") return "Run analysis";
  if (page === "runs" && runId === null) return "Previous analysis";
  if (page === "configuration") return "Configuration";
  if (page === "account") return "Account";
  return null;
}
