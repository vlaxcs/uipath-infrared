import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SlackScreen } from "~/slack/SlackScreen";
import { hostedSlackUrl } from "~/slack/host";

afterEach(cleanup);

describe("the Slack screen", () => {
  it("shows Slack with a login that survives restarts when the desktop window hosts it", () => {
    render(<SlackScreen slackUrl="https://infrared.slack.com" />);
    const view = screen.getByTestId("slack-view");
    expect(view.getAttribute("src")).toBe("https://infrared.slack.com");
    expect(view.getAttribute("partition")).toBe("persist:slack");
  });

  it("shows a placeholder in a plain browser", () => {
    render(<SlackScreen slackUrl={null} />);
    expect(screen.queryByTestId("slack-view")).toBeNull();
    expect(screen.getByTestId("slack-placeholder").textContent).toContain("npm run phone");
  });
});

describe("the address the desktop window passes to the page", () => {
  it("is read from the query string", () => {
    expect(hostedSlackUrl("?slack=https%3A%2F%2Finfrared.slack.com")).toBe("https://infrared.slack.com");
  });

  it("is absent in a plain browser", () => {
    expect(hostedSlackUrl("")).toBeNull();
  });
});
