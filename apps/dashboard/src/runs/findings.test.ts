import { describe, expect, it } from "vitest";
import { analysisOptions, evidenceText } from "~/runs/findings";

describe("reading analyses from findings", () => {
  it("keeps the id, title, category and risk", () => {
    expect(
      analysisOptions({
        findings: [
          { id: "F001", title: "Idle GPU node group", category: "delete_idle", risk: "low" },
          { id: "F002", title: "Orphan volumes", category: "storage_tiering" },
        ],
      }),
    ).toEqual([
      { id: "F001", title: "Idle GPU node group", category: "delete_idle", risk: "low" },
      { id: "F002", title: "Orphan volumes", category: "storage_tiering" },
    ]);
  });

  it("drops findings without an id, trims ids and de-duplicates", () => {
    expect(
      analysisOptions({
        findings: [
          { id: " F001 ", title: "First" },
          { id: "F001", title: "Duplicate" },
          { title: "No id" },
          { id: "   ", title: "Blank" },
          { id: 7, title: "Wrong type" },
        ],
      }),
    ).toEqual([{ id: "F001", title: "First" }]);
  });

  it("falls back to the id when the title is missing", () => {
    expect(analysisOptions({ findings: [{ id: "F003" }] })).toEqual([{ id: "F003", title: "F003" }]);
  });

  it("returns nothing for malformed documents", () => {
    expect(analysisOptions(null)).toEqual([]);
    expect(analysisOptions({})).toEqual([]);
    expect(analysisOptions({ findings: "none" })).toEqual([]);
    expect(analysisOptions({ findings: [] })).toEqual([]);
  });
});

describe("rendering finding evidence", () => {
  it("joins an evidence list and passes a single string through", () => {
    expect(evidenceText(["p95 97%", "2 vCPU"])).toBe("p95 97% 2 vCPU");
    expect(evidenceText("one line")).toBe("one line");
  });

  it("returns null for empty evidence", () => {
    expect(evidenceText(undefined)).toBeNull();
    expect(evidenceText("")).toBeNull();
    expect(evidenceText([])).toBeNull();
    expect(evidenceText(["", ""])).toBeNull();
  });
});
