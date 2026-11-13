import { describe, expect, it } from "vitest";
import { readSettings } from "./settings";

describe("the phone settings", () => {
  it("reads the Slack workspace address", () => {
    expect(readSettings({ SLACK_WORKSPACE_URL: "https://infrared.slack.com" })).toEqual({
      slackWorkspaceUrl: "https://infrared.slack.com",
    });
  });

  it("stops naming the variable when the workspace address is missing", () => {
    expect(() => readSettings({})).toThrow("SLACK_WORKSPACE_URL");
    expect(() => readSettings({ SLACK_WORKSPACE_URL: "" })).toThrow("SLACK_WORKSPACE_URL");
  });

  it("refuses an address that is not Slack", () => {
    expect(() => readSettings({ SLACK_WORKSPACE_URL: "https://example.com" })).toThrow("slack.com");
    expect(() => readSettings({ SLACK_WORKSPACE_URL: "http://infrared.slack.com" })).toThrow("slack.com");
  });
});
