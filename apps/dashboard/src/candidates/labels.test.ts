import { describe, expect, it } from "vitest";
import {
  actionLabel,
  confidenceMeta,
  constraintLabel,
  flagLabel,
  flagLabels,
  isNoOpAction,
  layerLabel,
  lostReasonMeta,
  OTHER_LAYER_LABEL,
  sourceLabel,
} from "~/candidates/labels";

describe("candidate vocabulary", () => {
  it("labels every action", () => {
    for (const kind of [
      "keep",
      "delete",
      "stop",
      "resize",
      "scale",
      "autoscale",
      "move",
      "remediate",
      "flag",
    ]) {
      expect(actionLabel(kind)).not.toBe(kind);
    }
    expect(actionLabel("keep")).toBe("Keep as is");
    expect(actionLabel("flag")).toBe("Finding");
    expect(actionLabel("teleport")).toBe("Teleport");
    expect(isNoOpAction("keep")).toBe(true);
    expect(isNoOpAction("flag")).toBe(true);
    expect(isNoOpAction("move")).toBe(false);
  });

  it("labels lost reasons and confidence, with a safe fallback", () => {
    expect(lostReasonMeta("cost")).toEqual({ label: "Cost", tone: "awaiting" });
    expect(lostReasonMeta("vibes")).toEqual({ label: "Vibes", tone: "neutral" });
    expect(confidenceMeta("high")).toEqual({ label: "High confidence", tone: "completed" });
    expect(confidenceMeta("certain")).toEqual({ label: "Certain", tone: "neutral" });
    expect(sourceLabel("agent")).toBe("Agent");
    expect(sourceLabel("robot")).toBe("Robot");
  });

  it("labels layers and keeps an Other group", () => {
    expect(layerLabel(undefined)).toBe(OTHER_LAYER_LABEL);
    expect(layerLabel("security_remediation")).toBe("Security remediation");
    expect(layerLabel("warp_drive")).toBe("Warp drive");
  });

  it("labels constraints and flags, keeping unknown strings", () => {
    expect(constraintLabel("min_availability_pct")).toBe("Minimum availability");
    expect(constraintLabel("quantum_budget")).toBe("Quantum budget");
    expect(flagLabel("catalog_illustrative")).toBe("Prices are illustrative");
    expect(flagLabel("brand_new_flag")).toBe("Brand new flag");
    expect(
      flagLabels(["catalog_illustrative", "brand_new_flag", "brand_new_flag"]),
    ).toEqual(["Prices are illustrative", "Brand new flag"]);
  });
});
