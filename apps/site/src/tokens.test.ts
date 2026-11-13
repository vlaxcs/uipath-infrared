import { describe, expect, it } from "vitest";
import tokensCss from "./tokens.css?raw";
import { colorPairs, contrastRatio, parseColorTokens, requiredRatio, themeBlock } from "./tokens.ts";

const tokens = parseColorTokens(tokensCss);
const valueOf = (name: string) => tokens.find((token) => token.name === name)?.value;

describe("contrast ratio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("tokens.css", () => {
  it("declares every colour a pair uses", () => {
    for (const pair of colorPairs) {
      expect(valueOf(pair.text), pair.text).toBeDefined();
      expect(valueOf(pair.background), pair.background).toBeDefined();
    }
  });

  it.each(colorPairs)("$text on $background passes WCAG AA", (pair) => {
    const ratio = contrastRatio(valueOf(pair.text)!, valueOf(pair.background)!);
    expect(ratio).toBeGreaterThanOrEqual(requiredRatio(pair));
  });

  it("keeps the brand green apart from the fixed-status green", () => {
    expect(valueOf("accent")).not.toBe(valueOf("status-fixed"));
  });
});

describe("theme block export", () => {
  it("writes edited colours back and leaves the rest of the file untouched", () => {
    const edited = tokens.map((token) => (token.name === "accent" ? { name: "accent", value: "#123456" } : token));
    const output = themeBlock(edited, tokensCss);
    expect(output).toContain("--color-accent: #123456;");
    expect(output).toContain(`--color-canvas: ${valueOf("canvas")};`);
    expect(output.replace("#123456", valueOf("accent")!)).toBe(tokensCss);
  });
});
