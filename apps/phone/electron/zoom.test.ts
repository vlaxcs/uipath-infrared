import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { applySlackZoom, SLACK_ZOOM_FACTOR } from "./zoom";

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
});
