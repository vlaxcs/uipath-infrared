import { afterEach, describe, expect, it } from "vitest";
import demo from "../../../state-view/data/states.json";
import { mountEstateView } from "~/plan/estateView";

const dataset = (demo as { dataset: { states: { id: string }[] } }).dataset;
let destroy: (() => void) | null = null;

afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});

function mount(options = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  destroy = mountEstateView(container, dataset, options);
  return container;
}

describe("Andrei's estate view, ported", () => {
  it("renders one timeline node per state and the topology into its container", () => {
    const container = mount();
    expect(container.classList.contains("estate-view")).toBe(true);
    expect(container.querySelectorAll("[data-tl-node]")).toHaveLength(dataset.states.length);
    expect(container.querySelector("svg.topo-graph")).toBeTruthy();
  });

  it("steps through the states with the arrow keys inside the view", () => {
    const container = mount();
    const current = () => container.querySelector('[aria-current="step"]')?.closest("[data-tl-node]")?.getAttribute("data-tl-node");
    expect(current()).toBe("0");
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(current()).toBe("1");
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(current()).toBe(String(dataset.states.length - 1));
  });

  it("leaves the page's own keys and hash alone", () => {
    mount();
    const before = window.location.hash;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(window.location.hash).toBe(before);
  });

  it("marks the component the sandbox failed, on the target state only", () => {
    const failed = (dataset.states[0] as unknown as { infra: { components: { id: string }[] } }).infra.components[0].id;
    const container = mount({ failedComponent: failed });
    const node = () => container.querySelector(`.tnode[data-node="${failed}"]`);
    expect(node()?.classList.contains("is-rehearsal-failed")).toBe(false);
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(node()?.classList.contains("is-rehearsal-failed")).toBe(true);
  });

  it("removes itself when destroyed", () => {
    const container = mount();
    destroy?.();
    destroy = null;
    expect(container.innerHTML).toBe("");
    expect(container.classList.contains("estate-view")).toBe(false);
  });
});

describe("zooming the topology", () => {
  it("zooms in and out within limits, and resets to 100%", () => {
    const container = mount();
    const level = () => container.querySelector("[data-topo-zoom-level]")!.textContent;
    const click = (how: string) => (container.querySelector(`[data-topo-zoom="${how}"]`) as HTMLButtonElement).click();
    click("in");
    expect(level()).toBe("125%");
    expect(container.querySelector("[data-topo-canvas]")!.classList.contains("is-zoomed")).toBe(true);
    click("out");
    click("out");
    expect(level()).toBe("100%");
    click("in");
    click("reset");
    expect(level()).toBe("100%");
  });
});
