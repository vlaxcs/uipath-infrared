import type { App, WebContents } from "electron";

export const SLACK_ZOOM_FACTOR = 0.55;

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
