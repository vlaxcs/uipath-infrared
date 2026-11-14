import { describe, expect, it } from "vitest";
import { PLAN_BUILD_LIMIT_MS, parallelTasks } from "~/runs/parallelTasks";
import type { RunEvent } from "~/runs/types";

const actor: RunEvent["actor"] = { kind: "orchestrator" };
const at = (seconds: number) => new Date(Date.UTC(2026, 10, 14, 6, 0, seconds)).toISOString();
const start = Date.parse(at(0));

const evaluated = (revision: number, seconds = 0): RunEvent => ({ seq: revision * 10, at: at(seconds), step: "evaluate", status: "completed", revision, actor });
const picked = (layout: string, seconds = 5): RunEvent => ({
  seq: 99,
  at: at(seconds),
  step: "present",
  status: "approved",
  revision: 1,
  actor,
  decision: { kind: "pick_layout", reason: "", layout },
});

describe("the work that runs beside the pipeline", () => {
  it("builds the winner's migration plan beside Present once evaluate completes", () => {
    const tasks = parallelTasks({ events: [evaluated(1)] }, "managed", new Set(), start + 1000);
    expect(tasks).toEqual([
      { id: "states.1.managed.json", label: "Migration plan · managed", beside: "present", file: "states.1.managed.json", state: "running" },
    ]);
  });

  it("builds a picked layout's plan beside Rehearse, unless the winner was picked", () => {
    const other = parallelTasks({ events: [evaluated(1), picked("lift")] }, "managed", new Set(["states.1.managed.json"]), start + 1000);
    expect(other.map((task) => [task.beside, task.state, task.file])).toEqual([
      ["present", "done", "states.1.managed.json"],
      ["rehearse", "running", "states.1.lift.json"],
    ]);
    expect(parallelTasks({ events: [evaluated(1), picked("managed")] }, "managed", new Set(), start)).toHaveLength(1);
  });

  it("follows the latest evaluated revision", () => {
    const tasks = parallelTasks({ events: [evaluated(1), evaluated(2, 30), picked("lift", 40)] }, "managed", new Set(), start + 41_000);
    expect(tasks.map((task) => task.file)).toEqual(["states.1.managed.json", "states.2.managed.json", "states.2.lift.json"]);
  });

  it("reports a plan that never appeared within the build limit as failed", () => {
    const [task] = parallelTasks({ events: [evaluated(1)] }, "managed", new Set(), start + PLAN_BUILD_LIMIT_MS + 1);
    expect(task.state).toBe("failed");
  });

  it("has nothing to build before the result names a winner", () => {
    expect(parallelTasks({ events: [evaluated(1)] }, null, new Set(), start)).toEqual([]);
  });
});
