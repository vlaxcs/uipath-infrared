import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsightsHome } from "~/insights/InsightsHome";
import { sampleInsightSource } from "~/insights/sampleInsightSource";
import type { InsightReader } from "~/insights/types";

afterEach(cleanup);

const href = (id: string) => `/app/runs/${id}`;
const sample: InsightReader = { ...sampleInsightSource, mode: "sample" };

describe("the home dashboard", () => {
  it("shows one orb per use case from the sample runs", async () => {
    render(<InsightsHome source={sample} runHref={href} onOpenRun={() => {}} />);

    const orbs = await screen.findAllByRole("button", { pressed: false, name: /runs/ });
    expect(orbs.map((orb) => orb.getAttribute("aria-label")?.split(":")[0])).toEqual([
      "Clinic Booking",
      "Demo Shop",
      "Fleet Telemetry",
      "Startup",
    ]);
    expect(screen.getByText("4 use cases · 11 runs")).toBeTruthy();
    expect(screen.getByText("sample")).toBeTruthy();
  });

  it("opens a use case into its runs, selects the newest, and Escape closes it", async () => {
    render(<InsightsHome source={sample} runHref={href} onOpenRun={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: /^Demo Shop:/ }));

    expect(screen.getByRole("button", { name: /^Demo Shop:/ }).getAttribute("aria-pressed")).toBe("true");
    // Three orbit dots, then three lanes once the river has faded in.
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Run #000\d, stopped$/ })).toHaveLength(6));
    await waitFor(() => expect(screen.getByText(/#0003 · 7 options/)).toBeTruthy());
    expect(screen.getByText("/mo today, no plan yet")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: /^Demo Shop:/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("links the selected lane to its run page when the data is live, and opens it in the app on a plain click", async () => {
    const onOpenRun = vi.fn();
    render(<InsightsHome source={{ ...sampleInsightSource, mode: "live" }} runHref={href} onOpenRun={onOpenRun} />);

    fireEvent.click(await screen.findByRole("button", { name: /^Startup:/ }));
    const link = await screen.findByRole("link", { name: "Open run #0003" });
    expect(link.getAttribute("href")).toBe("/app/runs/run-startup-0003");

    fireEvent.click(link, { metaKey: true });
    expect(onOpenRun).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(onOpenRun).toHaveBeenCalledWith("run-startup-0003");
  });

  it("keeps the other runs when one cannot be read, and says the view is not refreshed", async () => {
    const flaky: InsightReader = {
      ...sampleInsightSource,
      mode: "live",
      getRun: async (id, signal) => {
        if (id === "run-startup-0001") throw new Error("gone");
        return sampleInsightSource.getRun(id, signal);
      },
    };
    render(<InsightsHome source={flaky} runHref={href} onOpenRun={() => {}} />);

    expect(await screen.findByText("4 use cases · 10 runs")).toBeTruthy();
    expect(screen.getByText("not refreshed")).toBeTruthy();
  });

  it("says when the orchestrator does not answer", async () => {
    const failing: InsightReader = { ...sampleInsightSource, mode: "live", listRuns: async () => Promise.reject(new Error("refused")) };
    render(<InsightsHome source={failing} runHref={href} onOpenRun={() => {}} />);

    expect(await screen.findByText("The orchestrator did not answer: refused")).toBeTruthy();
  });
});
