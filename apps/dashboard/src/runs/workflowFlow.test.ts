import { describe, expect, it } from "vitest";
import type { RunDetail, RunEvent } from "~/runs/types";
import { workflowFlow } from "~/runs/workflowFlow";

const actor: RunEvent["actor"] = { kind: "orchestrator" };
let seq = 0;
const event = (step: RunEvent["step"], status: RunEvent["status"], extra: Partial<RunEvent> = {}): RunEvent => ({
  seq: ++seq,
  at: "2026-11-14T08:00:00Z",
  step,
  status,
  revision: 0,
  actor,
  ...extra,
});

type Shape = Pick<RunDetail, "events" | "status" | "awaiting" | "revision" | "max_revisions">;
const run = (events: RunEvent[], extra: Partial<Shape> = {}): Shape => ({ events, status: "running", revision: 0, max_revisions: 2, ...extra });

describe("the workflow flow of a run", () => {
  it("has nothing decided before extract finishes", () => {
    const flow = workflowFlow(run([event("extract", "started")]));
    expect(flow.extractCheck.outcome).toBe("pending");
    expect(flow.evaluateCheck.outcome).toBe("pending");
    expect(flow.layoutGate.state).toBe("pending");
    expect(flow.end).toBe("running");
  });

  it("follows a revise: the evaluate check says why, and the loop counts it", () => {
    const flow = workflowFlow(
      run(
        [
          event("extract", "completed"),
          event("evaluate", "completed", { decision: { kind: "revise", reason: "agent-db breaks data_residency" } }),
          event("evaluate", "started", { revision: 1 }),
        ],
        { revision: 1 },
      ),
    );
    expect(flow.extractCheck.outcome).toBe("passed");
    expect(flow.evaluateCheck).toEqual({ question: "Every agent candidate feasible?", outcome: "revised", reason: "agent-db breaks data_residency" });
    expect(flow.revisions).toBe(1);
    expect(flow.revision).toBe(1);
  });

  it("waits at the layout gate, then records the picked layout", () => {
    const evaluated = event("evaluate", "completed", { decision: { kind: "proceed", reason: "every candidate passes" } });
    const waiting = workflowFlow(run([evaluated, event("present", "awaiting_approval", { gate: "layout" })], { status: "awaiting_approval", awaiting: "layout" }));
    expect(waiting.layoutGate.state).toBe("awaiting");
    expect(waiting.evaluateCheck.outcome).toBe("passed");

    const picked = workflowFlow(run([evaluated, event("present", "approved", { decision: { kind: "pick_layout", reason: "", layout: "managed" } })]));
    expect(picked.layoutGate).toMatchObject({ state: "decided", detail: "managed" });
  });

  it("ends completed once the plan is approved", () => {
    const flow = workflowFlow(
      run(
        [
          event("rehearse", "completed", { decision: { kind: "proceed", reason: "99.94% over 99.9%" } }),
          event("rehearse", "approved", { decision: { kind: "approve_plan", reason: "ok" } }),
        ],
        { status: "completed" },
      ),
    );
    expect(flow.rehearseCheck.outcome).toBe("passed");
    expect(flow.planGate.state).toBe("decided");
    expect(flow.end).toBe("completed");
    expect(flow.failure).toBeNull();
  });

  it("names the step and the reason when the run fails", () => {
    const flow = workflowFlow(
      run([event("extract", "failed", { decision: { kind: "stop", reason: "infra.json does not match the contract" } })], { status: "failed" }),
    );
    expect(flow.extractCheck.outcome).toBe("stopped");
    expect(flow.failure).toEqual({ step: "extract", reason: "infra.json does not match the contract" });
    expect(flow.end).toBe("failed");
  });

  it("stops at evaluate when the revisions run out", () => {
    const flow = workflowFlow(
      run([event("evaluate", "failed", { decision: { kind: "stop", reason: "needs revision 3, max_revisions is 2" } })], { status: "failed", revision: 2 }),
    );
    expect(flow.evaluateCheck.outcome).toBe("stopped");
    expect(flow.failure?.step).toBe("evaluate");
  });
});
