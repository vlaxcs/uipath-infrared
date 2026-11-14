import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleRun } from "~/runs/sampleRun";
import { sampleRunSource } from "~/runs/sampleRunSource";
import { RunSourceError, type RunSource } from "~/runs/source";
import type { RunEvent } from "~/runs/types";
import { latestPickedLayout } from "~/sandbox/pickedLayout";
import { SandboxPanel } from "~/sandbox/SandboxPanel";
import { trialsIn } from "~/sandbox/useTrials";

afterEach(cleanup);

const trialDocument = (passed: boolean, rate: number) =>
  JSON.stringify({
    candidate_id: "managed_services",
    traffic_profile: { requests_per_second: rate },
    verdict: { passed, measured_availability_pct: passed ? 99.97 : 97.1, forecast_min_availability_pct: 99.9, reason: passed ? undefined : "db failover took 41 s" },
  });

function liveSource(files: Record<string, string>, overrides: Partial<RunSource> = {}): RunSource {
  return {
    ...sampleRunSource,
    mode: "live",
    listFiles: vi.fn(async () => Object.keys(files).map((path) => ({ path, size: files[path].length }))),
    readArtifact: vi.fn(async (_id: string, path: string) => files[path]),
    rehearse: vi.fn(async () => ({ file: "rehearsal.2.trial-3.json", candidate: "managed_services" })),
    ...overrides,
  };
}

describe("the sandbox panel", () => {
  it("lets a field be cleared and retyped, and sends the two numbers", async () => {
    const source = liveSource({});
    render(<SandboxPanel source={source} runId="run-1" layout="managed_services" pollMs={10} />);
    const rate = screen.getByLabelText("Requests per second") as HTMLInputElement;
    fireEvent.change(rate, { target: { value: "" } });
    expect(rate.value).toBe("");
    expect((screen.getByRole("button", { name: "Run trial" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(rate, { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Seconds per phase"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Run trial" }));
    await waitFor(() => expect(source.rehearse).toHaveBeenCalledWith("run-1", { requests_per_second: 150, phase_seconds: 30 }));
    expect(await screen.findByRole("button", { name: "Trial running" })).toBeTruthy();
  });

  it("lists trials newest first and shows the verdict of the one picked", async () => {
    const source = liveSource({
      "rehearsal.2.json": trialDocument(true, 5),
      "rehearsal.2.trial-1.json": trialDocument(true, 20),
      "rehearsal.2.trial-2.json": trialDocument(false, 200),
    });
    render(<SandboxPanel source={source} runId="run-1" layout="managed_services" />);

    const list = await screen.findByRole("list", { name: "Trials" });
    expect(within(list).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Trial 2 · revision 2",
      "Trial 1 · revision 2",
    ]);
    expect(await screen.findByText("db failover took 41 s")).toBeTruthy();
    expect(screen.getByText("200 requests/s")).toBeTruthy();

    fireEvent.click(within(list).getByRole("button", { name: "Trial 1 · revision 2" }));
    expect(await screen.findByText("20 requests/s")).toBeTruthy();
    expect(screen.getByText("Passed")).toBeTruthy();
  });

  it("shows a refused trial as an error and lets the user try again", async () => {
    const source = liveSource({}, {
      rehearse: vi.fn(async () => {
        throw new RunSourceError("trial running: a trial of run-1 is still running", 409);
      }),
    });
    render(<SandboxPanel source={source} runId="run-1" layout="managed_services" />);
    fireEvent.click(screen.getByRole("button", { name: "Run trial" }));
    expect((await screen.findByRole("alert")).textContent).toContain("still running");
    expect((screen.getByRole("button", { name: "Run trial" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("picks up the trial once its file appears", async () => {
    const files: Record<string, string> = {};
    const source = liveSource(files);
    render(<SandboxPanel source={source} runId="run-1" layout="managed_services" pollMs={10} />);
    fireEvent.click(screen.getByRole("button", { name: "Run trial" }));
    await screen.findByRole("button", { name: "Trial running" });

    files["rehearsal.2.trial-3.json"] = trialDocument(true, 10);
    expect(await screen.findByRole("button", { name: "Run trial" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trial 3 · revision 2" })).toBeTruthy();
  });

  it("cannot run trials on sample data", () => {
    render(<SandboxPanel source={sampleRunSource} runId={sampleRun.id} layout="managed_services" />);
    expect((screen.getByRole("button", { name: "Run trial" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Trials need a live orchestrator.")).toBeTruthy();
  });
});

describe("trial files", () => {
  it("keeps only trial rehearsals, newest revision and number first", () => {
    expect(trialsIn(["rehearsal.1.json", "rehearsal.1.trial-2.json", "rehearsal.2.trial-1.json", "rehearsal.1.trial-10.json", "result.1.json"]).map((trial) => trial.file)).toEqual([
      "rehearsal.2.trial-1.json",
      "rehearsal.1.trial-10.json",
      "rehearsal.1.trial-2.json",
    ]);
  });
});

describe("the picked layout", () => {
  const picked = (layout: string, seq: number): RunEvent => ({
    ...sampleRun.events[0],
    seq,
    decision: { kind: "pick_layout", reason: "", layout },
  });

  it("is the last layout the user picked, or none", () => {
    const undecided = sampleRun.events.filter((event) => event.decision?.kind !== "pick_layout");
    expect(latestPickedLayout({ events: undecided })).toBeNull();
    expect(latestPickedLayout({ events: [...undecided, picked("lift_and_shift", 90), picked("managed_services", 91)] })).toBe("managed_services");
  });
});
