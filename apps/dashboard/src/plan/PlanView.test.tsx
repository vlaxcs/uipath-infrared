import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleRunSource } from "~/runs/sampleRunSource";
import { RunSourceError, type RunSource } from "~/runs/source";

const mounted = vi.hoisted(() => ({ calls: [] as { dataset: unknown; options: unknown }[], destroyed: 0 }));

vi.mock("~/plan/estateView", () => ({
  mountEstateView: (_container: HTMLElement, dataset: unknown, options: unknown) => {
    mounted.calls.push({ dataset, options });
    return () => {
      mounted.destroyed += 1;
    };
  },
}));

const { PlanView } = await import("~/plan/PlanView");

afterEach(() => {
  cleanup();
  mounted.calls.length = 0;
  mounted.destroyed = 0;
});

function sourceWith(files: Record<string, string>): RunSource {
  return {
    ...sampleRunSource,
    mode: "live",
    readArtifact: async (_id, path) => {
      if (!(path in files)) throw new RunSourceError("not found", 404);
      return files[path];
    },
  };
}

const STATES = JSON.stringify({ dataset: { states: [{ id: "state-0" }], stepCount: 0 } });

describe("the migration plan view", () => {
  it("mounts Andrei's view with the candidate's states", async () => {
    render(<PlanView source={sourceWith({ "states.1.managed_services.json": STATES })} runId="run-1" revision={1} candidate="managed_services" rehearsalPath={null} />);
    await waitFor(() => expect(mounted.calls).toHaveLength(1));
    expect(mounted.calls[0].dataset).toEqual({ states: [{ id: "state-0" }], stepCount: 0 });
  });

  it("marks the component the sandbox failed when the rehearsal is of this candidate", async () => {
    const rehearsal = JSON.stringify({ candidate_id: "managed_services", failure: { target_component: "app-db" } });
    render(
      <PlanView
        source={sourceWith({ "states.1.managed_services.json": STATES, "rehearsal.1.json": rehearsal })}
        runId="run-1" revision={1} candidate="managed_services" rehearsalPath="rehearsal.1.json"
      />,
    );
    await waitFor(() => expect(mounted.calls.at(-1)?.options).toEqual({ failedComponent: "app-db" }));
  });

  it("ignores a rehearsal of another candidate", async () => {
    const rehearsal = JSON.stringify({ candidate_id: "rightsize_in_place", failure: { target_component: "app-db" } });
    render(
      <PlanView
        source={sourceWith({ "states.1.managed_services.json": STATES, "rehearsal.1.json": rehearsal })}
        runId="run-1" revision={1} candidate="managed_services" rehearsalPath="rehearsal.1.json"
      />,
    );
    await waitFor(() => expect(mounted.calls.length).toBeGreaterThan(0));
    expect(mounted.calls.every((call) => (call.options as { failedComponent?: string }).failedComponent === undefined)).toBe(true);
  });

  it("says when no plan was built for the candidate, without mounting", async () => {
    render(<PlanView source={sourceWith({})} runId="run-1" revision={1} candidate="cleanup_orphans" rehearsalPath={null} />);
    expect(await screen.findByText(/No plan built for cleanup_orphans/)).toBeTruthy();
    expect(mounted.calls).toHaveLength(0);
  });

  it("refuses a file that is not a states document", async () => {
    render(<PlanView source={sourceWith({ "states.1.x.json": "{\"nope\": 1}" })} runId="run-1" revision={1} candidate="x" rehearsalPath={null} />);
    expect(await screen.findByText("The plan file is not a states document.")).toBeTruthy();
  });

  it("cleans the view up when it goes away", async () => {
    const { unmount } = render(<PlanView source={sourceWith({ "states.1.a.json": STATES })} runId="run-1" revision={1} candidate="a" rehearsalPath={null} />);
    await waitFor(() => expect(mounted.calls).toHaveLength(1));
    unmount();
    expect(mounted.destroyed).toBe(1);
  });
});
