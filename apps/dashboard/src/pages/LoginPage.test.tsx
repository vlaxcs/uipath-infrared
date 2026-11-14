import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "~/pages/LoginPage";

function renderLogin() {
  return render(<LoginPage orchestratorUrl={null} onContinue={() => {}} onSignedIn={() => {}} />);
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} })),
  );
}

function scene(container: HTMLElement) {
  const svg = container.querySelector("svg[data-scene='infrastructure']");
  if (!svg) throw new Error("no infrastructure scene on the login page");
  return svg;
}

describe("the login page's infrastructure scene", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("moves workloads between the three sites, each along its drawn link", () => {
    stubReducedMotion(false);
    const svg = scene(renderLogin().container);
    const motions = [...svg.getElementsByTagName("animateMotion")];
    const links = [...svg.querySelectorAll("path[data-link]")];
    expect(motions).toHaveLength(7);
    expect(links).toHaveLength(7);
    expect(motions.every((motion) => motion.getAttribute("repeatCount") === "indefinite")).toBe(true);
  });

  it("holds still when the person asked for reduced motion, and still draws the sites", () => {
    stubReducedMotion(true);
    const svg = scene(renderLogin().container);
    expect(svg.getElementsByTagName("animateMotion")).toHaveLength(0);
    expect(svg.getElementsByTagName("animate")).toHaveLength(0);
    expect(svg.querySelectorAll("path[data-link]")).toHaveLength(7);
  });

  it("stays out of the way of assistive tech, so sign-in is the page's only action", () => {
    stubReducedMotion(false);
    const svg = scene(renderLogin().container);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
