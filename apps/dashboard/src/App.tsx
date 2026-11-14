import { useEffect, useEffectEvent, useState } from "react";
import { onSignedOut, signOut } from "~/account/session";
import { createHttpAccountSource, sampleAccountSource, type AccountSource } from "~/account/accountSource";
import { useAccount } from "~/account/useAccount";
import { HomePage } from "~/home/HomePage";
import { routePath, type PageId } from "~/navigation/route";
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
  const [signedOut, setSignedOut] = useState(false);
  const openLogin = useEffectEvent(() => {
    setSignedOut(true);
    route.go("login");
  });

  useEffect(() => onSignedOut(openLogin), []);

  function enterSignedIn() {
    window.location.assign(import.meta.env.BASE_URL);
  }

  function disconnect() {
    if (orchestratorUrl) void signOut(orchestratorUrl);
    setSignedOut(true);
    route.go("login");
  }

  function continueWithSamples() {
    setSignedOut(false);
    route.go("home");
  }

  if (signedOut || route.page === "login") {
    return <LoginPage orchestratorUrl={orchestratorUrl} onContinue={continueWithSamples} onSignedIn={enterSignedIn} />;
  }

  return (
    <Frame
      showBack={route.page !== "home"}
      title={pageTitle(route.page, route.runId)}
      account={account}
      onBack={route.back}
      onHome={() => route.go("home")}
      onNavigate={route.go}
      onDisconnect={disconnect}
      onRefresh={() => setRefreshes((count) => count + 1)}
    >
      <RefreshProvider value={refreshes}>
      {route.page === "home" ? (
        <HomePage
          extensionUrl={extensionUrl}
          onAnalyze={() => route.go("analyze")}
          onPrevious={() => route.go("runs")}
          source={source}
          runHref={(runId) => import.meta.env.BASE_URL + routePath({ page: "runs", runId, focusGate: false })}
          onOpenRun={route.openRun}
        />
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
