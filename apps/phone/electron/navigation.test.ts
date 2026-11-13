import { describe, expect, it } from "vitest";
import { opensInBrowser, staysInPhone } from "./navigation";

describe("where an address opens", () => {
  it("keeps Slack and its sign-in providers inside the phone", () => {
    expect(staysInPhone("https://app.slack.com/client")).toBe(true);
    expect(staysInPhone("https://infrared.slack.com/archives/C1")).toBe(true);
    expect(staysInPhone("https://accounts.google.com/o/oauth2/auth")).toBe(true);
  });

  it("sends other sites to the browser", () => {
    expect(staysInPhone("https://github.com/org/repo/pull/1")).toBe(false);
    expect(opensInBrowser("https://github.com/org/repo/pull/1")).toBe(true);
  });

  it("is not fooled by a lookalike host", () => {
    expect(staysInPhone("https://slack.com.example.com")).toBe(false);
    expect(staysInPhone("https://notslack.com")).toBe(false);
    expect(staysInPhone("http://app.slack.com")).toBe(false);
  });

  it("opens nothing for an address that is not a web page", () => {
    expect(opensInBrowser("slack://open")).toBe(false);
    expect(opensInBrowser("file:///etc/passwd")).toBe(false);
    expect(opensInBrowser("not an address")).toBe(false);
  });
});
