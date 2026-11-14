import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_HINT,
  LAST_TARGET_HINT,
  canStart,
  initialAnswers,
  onpremChoice,
  startRequest,
  targetChoices,
  withProject,
  withTarget,
} from "~/onboarding/answers";
import { providerLabel } from "~/onboarding/providers";
import type { OnboardingSetup } from "~/onboarding/types";

const setup: OnboardingSetup = {
  connections: [{ id: "floci", label: "AWS (demo estate)" }],
  providers: ["aws", "gcp", "managed_pg"],
  onprem: true,
  projects: [
    { id: "startup", description: "A start-up", forbidden_providers: [] },
    { id: "strict", description: "", forbidden_providers: ["gcp", "onprem"] },
  ],
};

describe("the onboarding answers", () => {
  it("start with the first connection and project, every provider ticked and on-prem off", () => {
    expect(initialAnswers(setup)).toEqual({ connection: "floci", project: "startup", targets: ["aws", "gcp", "managed_pg"], onprem: false });
  });

  it("drop what the newly picked project forbids", () => {
    const answers = withProject(setup, { ...initialAnswers(setup), onprem: true }, "strict");
    expect(answers.targets).toEqual(["aws", "managed_pg"]);
    expect(answers.onprem).toBe(false);
  });

  it("never untick the last target", () => {
    const one = { ...initialAnswers(setup), targets: ["aws"] };
    expect(withTarget(one, "aws", false)).toBe(one);
    expect(withTarget(one, "gcp", true).targets).toEqual(["aws", "gcp"]);
    expect(withTarget(initialAnswers(setup), "gcp", false).targets).toEqual(["aws", "managed_pg"]);
  });

  it("show a forbidden provider unticked and disabled, and the last ticked one disabled", () => {
    const answers = { ...withProject(setup, initialAnswers(setup), "strict"), targets: ["managed_pg"] };
    expect(targetChoices(setup, answers)).toEqual([
      { id: "aws", label: "AWS", ticked: false, disabled: false, hint: undefined },
      { id: "gcp", label: "Google Cloud", ticked: false, disabled: true, hint: FORBIDDEN_HINT },
      { id: "managed_pg", label: "Managed Postgres", ticked: true, disabled: true, hint: LAST_TARGET_HINT },
    ]);
  });

  it("hide on-prem when the catalog has none and disable it when the project forbids it", () => {
    expect(onpremChoice({ ...setup, onprem: false }, initialAnswers(setup))).toBeNull();
    const strict = withProject(setup, initialAnswers(setup), "strict");
    expect(onpremChoice(setup, { ...strict, onprem: true })).toMatchObject({ ticked: false, disabled: true, hint: FORBIDDEN_HINT });
  });

  it("need a project and a target to start", () => {
    expect(canStart(setup, initialAnswers(setup))).toBe(true);
    expect(canStart({ ...setup, projects: [] }, initialAnswers({ ...setup, projects: [] }))).toBe(false);
    expect(canStart(setup, { ...initialAnswers(setup), targets: [] })).toBe(false);
  });

  it("become the body POST /runs takes", () => {
    expect(startRequest({ connection: "floci", project: "startup", targets: ["aws"], onprem: true })).toEqual({
      project: "startup",
      onboarding: { connection: "floci", targets: ["aws"], onprem: { wanted: true } },
    });
  });

  it("label known providers and show unknown ones as they are", () => {
    expect(providerLabel("other")).toBe("Other providers (Hetzner, Fly.io, R2 and more)");
    expect(providerLabel("hetzner")).toBe("hetzner");
  });
});
