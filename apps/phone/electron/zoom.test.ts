import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { applySlackZoom, PHONE_SCREEN_WIDTH, SLACK_LAYOUT_WIDTH, SLACK_ZOOM_FACTOR } from "./zoom";

class FakeContents extends EventEmitter {
  zoomFactor: number | null = null;

  setZoomFactor(factor: number) {
    this.zoomFactor = factor;
  }
}

describe("fitting the Slack view to the phone", () => {
  it("zooms it out when its page is ready", () => {
    const contents = new FakeContents();
    applySlackZoom(contents);
    expect(contents.zoomFactor).toBeNull();
    contents.emit("dom-ready");
    expect(contents.zoomFactor).toBe(SLACK_ZOOM_FACTOR);
  });

  it("zooms as far in as the screen allows without clipping the client", () => {
    const layoutWidth = PHONE_SCREEN_WIDTH / SLACK_ZOOM_FACTOR;
    expect(layoutWidth).toBeGreaterThanOrEqual(SLACK_LAYOUT_WIDTH);
    expect(PHONE_SCREEN_WIDTH / (SLACK_ZOOM_FACTOR + 0.01)).toBeLessThan(SLACK_LAYOUT_WIDTH);
  });
});
