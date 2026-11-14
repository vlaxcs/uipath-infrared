import { describe, expect, it } from "vitest";
import { projectFacts, projectLabel } from "~/onboarding/projectFacts";

const clinic = {
  id: "clinic-booking",
  description: "Clinic booking forecast",
  forbidden_providers: [],
  profile: {
    name: "Clinic booking",
    summary: "A booking platform for private clinics.",
    markets: ["Romania"],
    environments: ["prod", "staging", "dev"],
    users: { metric: "monthly_active_users", current: 41000, expected: 112500, at_month: 24 },
  },
};

describe("a project in New analysis", () => {
  it("is named and described from its profile", () => {
    expect(projectLabel(clinic)).toBe("Clinic booking");
    expect(projectFacts(clinic)).toBe(
      "A booking platform for private clinics. prod, staging, dev · 41,000 MAU now, 112,500 expected at month 24 · Romania",
    );
  });

  it("falls back to its id and forecast description without a profile", () => {
    const bare = { id: "alpha", description: "Alpha forecast", forbidden_providers: [] };
    expect(projectLabel(bare)).toBe("alpha");
    expect(projectFacts(bare)).toBe("Alpha forecast");
  });
});
