const POPUPS_REACH_THE_GUARD = "true" as unknown as boolean;

export function SlackScreen({ slackUrl }: { slackUrl: string | null }) {
  if (!slackUrl) {
    return (
      <p className="m-auto px-8 text-center text-muted" data-testid="slack-placeholder">
        Slack shows here when the frame runs as the desktop window: npm run phone
      </p>
    );
  }
  return (
    <webview
      className="flex min-h-0 flex-1 bg-browser-canvas"
      src={slackUrl}
      partition="persist:slack"
      allowpopups={POPUPS_REACH_THE_GUARD}
      data-testid="slack-view"
    />
  );
}
