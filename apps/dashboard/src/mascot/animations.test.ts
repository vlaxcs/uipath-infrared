import { describe, expect, it } from "vitest";
import { animationForRun } from "~/mascot/animations";

describe("the mascot's animation for a run", () => {
  it("follows the step in progress", () => {
    expect(animationForRun("extract", "running")).toBe("scan");
    expect(animationForRun("propose", "running")).toBe("reorganise");
    expect(animationForRun("evaluate", "running")).toBe("chomp");
    expect(animationForRun("rehearse", "running")).toBe("grow");
  });

  it("waits at a gate, ends with sunset, fails with the hood", () => {
    expect(animationForRun("present", "awaiting_approval")).toBe("float");
    expect(animationForRun("rehearse", "completed")).toBe("sunset");
    expect(animationForRun("evaluate", "failed")).toBe("hood");
  });
});
