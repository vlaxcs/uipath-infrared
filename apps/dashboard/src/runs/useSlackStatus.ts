import { useEffect, useState } from "react";
import type { RunSource, SlackStatus } from "~/runs/source";

const POLL_MS = 10_000;

/* Whether the Slack bot is polling the orchestrator; null when the source cannot tell. */
export function useSlackStatus(source: RunSource): SlackStatus | null {
  const [status, setStatus] = useState<SlackStatus | null>(null);

  useEffect(() => {
    const ask = source.slackStatus;
    if (!ask) return;
    const controller = new AbortController();
    const check = () =>
      ask(controller.signal).then(setStatus, () => {
        if (!controller.signal.aborted) setStatus({ connected: false });
      });
    void check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [source]);

  return status;
}
