import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { pitchCopy, type PitchCopy, type Todo } from "./copy.ts";
import { Pitch } from "./Pitch.tsx";

function leaves(value: unknown, path: string): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return [[`${path}.length`, value.length], ...value.flatMap((item, index) => leaves(item, `${path}[${index}]`))];
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
}

function todos(copy: PitchCopy): Todo[] {
  const found: Todo[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === "object") {
      if ("todo" in value) found.push(value as Todo);
      else Object.values(value).forEach(walk);
    }
  };
  walk(copy);
  return found;
}

const BAND_ORDER = (copy: PitchCopy) => [
  copy.duty.title,
  copy.problem.title,
  copy.solution.title,
  copy.how.title,
  copy.product.title,
  copy.competition.title,
  copy.market.title,
  copy.numbers.title,
  copy.whyNow.title,
];

describe("pitch copy", () => {
  it("has the same shape in English and Romanian", () => {
    const shape = (entries: Array<[string, unknown]>) =>
      entries.map(([path, value]) => (path.endsWith(".length") ? `${path}=${value}` : path));
    expect(shape(leaves(pitchCopy.ro, ""))).toEqual(shape(leaves(pitchCopy.en, "")));
  });

  it("has no empty string in either language", () => {
    for (const [path, value] of [...leaves(pitchCopy.en, ""), ...leaves(pitchCopy.ro, "")]) {
      if (typeof value === "string") expect(value.trim(), path).not.toBe("");
    }
  });
});

describe("pitch page", () => {
  it("opens in English with Infrared as the title", () => {
    render(<Pitch />);
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Infrared");
    expect(screen.getAllByText("by Digi").length).toBeGreaterThan(0);
  });

  it("says from the start that nobody installs anything, then why providers need it", () => {
    render(<Pitch />);
    expect(screen.getByText(pitchCopy.en.hero.noInstall)).toBeInTheDocument();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(titles[0]).toBe(pitchCopy.en.duty.title);
  });

  it("shows the first law's full text, and the one she clicks or reaches with the arrow keys", async () => {
    render(<Pitch />);
    const [first, second, third] = pitchCopy.en.duty.laws;
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent(first.says);
    expect(panel).toHaveTextContent(first.source);

    await userEvent.click(tabs[1]);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(second.says);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(third.says);
    expect(document.activeElement).toBe(tabs[2]);
  });

  it("shows the bands in the agreed order, then the team and the closing", () => {
    render(<Pitch />);
    const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    const expected = BAND_ORDER(pitchCopy.en);
    const positions = expected.map((title) => titles.indexOf(title));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(titles.indexOf(pitchCopy.en.closing.title)).toBe(titles.length - 1);
  });

  it("shows every PRD placeholder with its TODO label", () => {
    const { container } = render(<Pitch />);
    const shown = [...container.querySelectorAll("[data-todo]")].map((node) => node.textContent);
    const expected = todos(pitchCopy.en).map((slot) => `[TODO: ${slot.todo}]`);
    expect(expected.length).toBeGreaterThan(0);
    expect(shown.sort()).toEqual(expected.sort());
  });

  it("switches every band to Romanian", async () => {
    const { container } = render(<Pitch />);
    await userEvent.click(screen.getByRole("button", { name: "RO" }));
    expect(document.documentElement.lang).toBe("ro");
    for (const title of BAND_ORDER(pitchCopy.ro)) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    expect(screen.queryByText(pitchCopy.en.closing.title)).not.toBeInTheDocument();
    const shown = [...container.querySelectorAll("[data-todo]")].map((node) => node.textContent ?? "");
    expect(shown.every((text) => text.startsWith("[COMPLETEAZĂ: "))).toBe(true);
  });
});
