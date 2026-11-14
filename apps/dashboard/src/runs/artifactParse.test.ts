import { describe, expect, it } from "vitest";
import { artifactSummary, parseArtifact } from "~/runs/artifactParse";

const infra = { components: [{}, {}], edges: [{}] };
const findings = { findings: [{}, {}, {}] };
const candidates = { candidates: [{}, {}] };
const result = { winner: "consolidate", candidates: [{}, {}, {}] };
const passedRehearsal = { verdict: { passed: true } };
const failedRehearsal = { verdict: { passed: false } };

describe("parsing an artifact", () => {
  it("returns the JSON value", () => {
    expect(parseArtifact('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("reports invalid JSON instead of throwing", () => {
    const parsed = parseArtifact("{");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toBeTruthy();
  });
});

describe("summarising an artifact", () => {
  it("counts the shape of each known contract", () => {
    expect(artifactSummary("infra.json", infra)).toBe("2 components, 1 dependencies");
    expect(artifactSummary("findings.json", findings)).toBe("3 findings");
    expect(artifactSummary("candidates.1.json", candidates)).toBe("2 candidates");
    expect(artifactSummary("result.0.json", result)).toBe("winner consolidate, 3 candidates");
    expect(artifactSummary("rehearsal.0.json", passedRehearsal)).toBe("rehearsal passed");
    expect(artifactSummary("rehearsal.0.json", failedRehearsal)).toBe("rehearsal failed");
  });

  it("returns an empty summary when the shape is unknown", () => {
    expect(artifactSummary("infra.json", {})).toBe("");
    expect(artifactSummary("other.json", infra)).toBe("");
    expect(artifactSummary("result.0.json", "nope")).toBe("");
  });
});
