import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "@tailwindcss/node";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

beforeAll(async () => {
  const compiler = await compile(readFileSync(join(SRC, "index.css"), "utf8"), {
    base: SRC,
    onDependency: () => {},
  });
  const style = document.createElement("style");
  style.textContent = compiler.build(["cursor-grab"]);
  document.head.append(style);
});

afterEach(cleanup);

describe("the pointer over interactive elements", () => {
  it("turns into a hand over an enabled button", () => {
    render(<button type="button">Analyze</button>);
    expect(getComputedStyle(screen.getByRole("button")).cursor).toBe("pointer");
  });

  it("says not allowed over a disabled button", () => {
    render(<button type="button" disabled>Browser extension</button>);
    expect(getComputedStyle(screen.getByRole("button")).cursor).toBe("not-allowed");
  });

  it("turns into a hand over a disclosure summary", () => {
    render(
      <details>
        <summary>Raw JSON</summary>
      </details>,
    );
    expect(getComputedStyle(screen.getByText("Raw JSON")).cursor).toBe("pointer");
  });

  it("lets a cursor utility on the button win", () => {
    render(<button type="button" className="cursor-grab">Drag</button>);
    expect(getComputedStyle(screen.getByRole("button")).cursor).toBe("grab");
  });
});
