import { describe, expect, it } from "vitest";
import { STEP_META } from "~/runs/stepMeta";
import type { RunStep, StepState } from "~/runs/types";
import type { WorkflowFlow } from "~/runs/workflowFlow";
import { LAYOUT_WIDTH, workflowLayout } from "~/runs/workflowLayout";

const titles = Object.fromEntries(Object.entries(STEP_META).map(([id, meta]) => [id, meta.title])) as Record<RunStep, string>;
const states: Record<RunStep, StepState> = { extract: "done", investigate: "done", propose: "done", evaluate: "done", present: "awaiting", rehearse: "pending" };
const pending = { question: "?", outcome: "pending" as const, reason: null };

function flow(overrides: Partial<WorkflowFlow> = {}): WorkflowFlow {
  return {
    revision: 0,
    maxRevisions: 2,
    revisions: 0,
    evaluateRevisions: 0,
    rehearseRevisions: 0,
    extractCheck: { ...pending, outcome: "passed" },
    evaluateCheck: { ...pending, outcome: "passed" },
    rehearseCheck: pending,
    layoutGate: { label: "CTO picks a feasible layout", state: "awaiting", detail: null },
    planGate: { label: "CTO approves the plan", state: "pending", detail: null },
    end: "running",
    failure: null,
    ...overrides,
  };
}

const plans = [
  { id: "a", label: "Migration plan · managed", beside: "present" as const, file: "states.0.managed.json", candidate: "managed", state: "done" as const },
  { id: "b", label: "Migration plan · lift", beside: "rehearse" as const, file: "states.0.lift.json", candidate: "lift", state: "running" as const },
];

describe("the workflow layout", () => {
  it("puts each node of the spine on its own row, moving right", () => {
    const { nodes } = workflowLayout(flow(), "startup", titles, states, [], 0);
    const spine = nodes.filter((node) => node.kind !== "side");
    for (let index = 1; index < spine.length; index += 1) {
      expect(spine[index].y).toBeGreaterThan(spine[index - 1].y + spine[index - 1].height);
      expect(spine[index].x).toBeGreaterThan(spine[index - 1].x);
    }
  });

  it("keeps every node and side branch inside its fixed width, whatever the screen", () => {
    const layout = workflowLayout(flow({ revisions: 2, evaluateRevisions: 1, rehearseRevisions: 1 }), "startup", titles, states, plans, 3);
    expect(layout.width).toBe(LAYOUT_WIDTH);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it("colours a return edge only once the run went back through it, and counts the trips", () => {
    const quiet = workflowLayout(flow(), "startup", titles, states, [], 0);
    expect(quiet.edges.find((edge) => edge.id === "revise-evaluate")).toMatchObject({ tone: "idle", label: "revise" });
    expect(quiet.loop.used).toBe(false);

    const revised = workflowLayout(flow({ revisions: 2, evaluateRevisions: 2 }), "startup", titles, states, [], 0);
    expect(revised.edges.find((edge) => edge.id === "revise-evaluate")).toMatchObject({ tone: "returned", label: "revise x2", returns: true });
    expect(revised.edges.find((edge) => edge.id === "revise-rehearse")?.tone).toBe("idle");
    expect(revised.loop.used).toBe(true);
  });

  it("marks the edge into a node waiting for a decision as active, and edges into done nodes as taken", () => {
    const { edges } = workflowLayout(flow(), "startup", titles, states, [], 0);
    expect(edges.find((edge) => edge.id === "evaluate-feasible")?.tone).toBe("taken");
    expect(edges.find((edge) => edge.id === "present-layout-gate")?.tone).toBe("active");
    expect(edges.find((edge) => edge.id === "rehearse-forecast")?.tone).toBe("idle");
    expect(edges.find((edge) => edge.id === "end-pr")?.tone).toBe("later");
  });

  it("hangs the plan builds and trials beside the rows they run with", () => {
    const { nodes } = workflowLayout(flow(), "startup", titles, states, plans, 2);
    const row = (id: string) => nodes.find((node) => node.id === id)!;
    expect(row("a").beside).toBe("present");
    expect(row("a").y + row("a").height / 2).toBe(row("feasible").y + row("feasible").height / 2);
    expect(row("b").x + row("b").width).toBeLessThan(row("layout-gate").x);
    expect(row("trials").label).toBe("Trials: 2");
  });
});
