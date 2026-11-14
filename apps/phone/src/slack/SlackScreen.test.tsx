import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlackScreen } from "~/slack/SlackScreen";
import { hostedSlackUrl } from "~/slack/host";

afterEach(cleanup);

function renderHostedSlack(history: { back: boolean; forward: boolean }) {
  render(<SlackScreen slackUrl="https://infrared.slack.com" />);
  const view = Object.assign(screen.getByTestId("slack-view"), {
    canGoBack: () => history.back,
    canGoForward: () => history.forward,
    goBack: vi.fn(),
    goForward: vi.fn(),
  });
  const navigate = (event: "did-navigate" | "did-navigate-in-page") => act(() => { view.dispatchEvent(new Event(event)); });
  return { view, navigate };
}

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
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByTestId("slack-placeholder").textContent).toContain("npm run phone");
  });
});

describe("going back and forward in Slack", () => {
  it("has nowhere to go before Slack navigates", () => {
    renderHostedSlack({ back: false, forward: false });
    expect(screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Forward" }).hasAttribute("disabled")).toBe(true);
  });

  it("goes back to the previous Slack page", () => {
    const { view, navigate } = renderHostedSlack({ back: true, forward: false });
    navigate("did-navigate");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(view.goBack).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Forward" }).hasAttribute("disabled")).toBe(true);
  });

  it("goes forward again after going back", () => {
    const { view, navigate } = renderHostedSlack({ back: false, forward: true });
    navigate("did-navigate");
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(view.goForward).toHaveBeenCalledOnce();
  });

  it("follows navigation inside Slack's single page app", () => {
    const { navigate } = renderHostedSlack({ back: true, forward: false });
    navigate("did-navigate-in-page");
    expect(screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(false);
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
