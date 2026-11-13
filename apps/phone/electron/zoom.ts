import type { App, WebContents } from "electron";

/** Slack's signed-in client lays out at 668 px; the phone's screen is 396 px wide. */
export const SLACK_LAYOUT_WIDTH = 668;
export const PHONE_SCREEN_WIDTH = 396;

/**
 * The largest zoom at which the full client still fits (396 / 668 ≈ 0.593),
 * rounded down so rounding in the layout engine cannot clip it.
 */
export const SLACK_ZOOM_FACTOR = Math.floor((PHONE_SCREEN_WIDTH / SLACK_LAYOUT_WIDTH) * 100) / 100;

type ZoomableContents = {
  on(event: "dom-ready", listener: () => void): unknown;
  setZoomFactor(factor: number): void;
};

export function applySlackZoom(contents: ZoomableContents) {
  contents.on("dom-ready", () => contents.setZoomFactor(SLACK_ZOOM_FACTOR));
}

export function fitSlackViews(app: App) {
  app.on("web-contents-created", (_event, contents: WebContents) => {
    if (contents.getType() === "webview") applySlackZoom(contents);
  });
}
