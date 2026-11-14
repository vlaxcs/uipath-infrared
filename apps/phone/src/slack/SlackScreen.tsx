import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Icon from "~/phone/icons";

const POPUPS_REACH_THE_GUARD = "true" as unknown as boolean;
const HISTORY_EVENTS = ["did-navigate", "did-navigate-in-page"] as const;

type SlackView = HTMLElement & {
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
};

function useSlackHistory() {
  const viewRef = useRef<SlackView>(null);
  const [history, setHistory] = useState({ back: false, forward: false });
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const refresh = () => setHistory({ back: view.canGoBack(), forward: view.canGoForward() });
    for (const event of HISTORY_EVENTS) view.addEventListener(event, refresh);
    return () => {
      for (const event of HISTORY_EVENTS) view.removeEventListener(event, refresh);
    };
  }, []);
  return {
    viewRef,
    history,
    goBack: () => viewRef.current?.goBack(),
    goForward: () => viewRef.current?.goForward(),
  };
}

function HistoryButton({ label, enabled, onPress, children }: { label: string; enabled: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!enabled}
      onClick={onPress}
      className="flex size-11 items-center justify-center rounded-full text-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foreground disabled:text-muted disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

export function SlackScreen({ slackUrl }: { slackUrl: string | null }) {
  const { viewRef, history, goBack, goForward } = useSlackHistory();
  if (!slackUrl) {
    return (
      <p className="m-auto px-8 text-center text-muted" data-testid="slack-placeholder">
        Slack shows here when the frame runs as the desktop window: npm run phone
      </p>
    );
  }
  return (
    <>
      <webview
        ref={viewRef as never}
        className="flex min-h-0 flex-1 bg-browser-canvas"
        src={slackUrl}
        partition="persist:slack"
        allowpopups={POPUPS_REACH_THE_GUARD}
        data-testid="slack-view"
      />
      <nav aria-label="Slack history" className="flex shrink-0 items-center gap-2 border-t border-surface bg-background px-4 pt-1 pb-1 bezel:pb-5">
        <HistoryButton label="Back" enabled={history.back} onPress={goBack}><Icon.ChevronBack /></HistoryButton>
        <HistoryButton label="Forward" enabled={history.forward} onPress={goForward}><Icon.ChevronForward /></HistoryButton>
      </nav>
    </>
  );
}
