import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrchestratorError, type OnboardingSource } from "~/onboarding/api";
import { OnboardingSection } from "~/onboarding/OnboardingSection";
import type { MapEngine, MapGestures } from "~/onboarding/mapEngine";
import type { OnboardingSetup } from "~/onboarding/types";
import { DEFAULT_CRITERIA, DEFAULT_PROFILE } from "~/onboarding/criteria";

afterEach(cleanup);

const setup: OnboardingSetup = {
  connections: [{ id: "floci", label: "AWS (demo estate)" }],
  providers: ["aws", "managed_pg"],
  onprem: true,
  projects: [
    { id: "startup", description: "A start-up with a poor infrastructure", forbidden_providers: [] },
    { id: "strict", description: "", forbidden_providers: ["managed_pg"] },
  ],
};

const payments = { id: "payments", name: "Payments API", summary: "Card payments for the shops", stacks: ["payments-prod"], users: { metric: "monthly_active_users", current: 52000, expected: 190000, at_month: 36 } };
const hr = { id: "hr-portal", name: "HR portal", summary: "", stacks: ["hr-portal-prod"], users: { metric: "internal_users", current: 900, expected: 1450, at_month: 36 } };

const company: OnboardingSetup = {
  ...setup,
  company: "northwind",
  projects: [
    { id: "alpha", description: "", forbidden_providers: [], applications: [{ ...hr, id: "alpha-app", name: "Alpha app" }] },
    { id: "northwind", description: "", forbidden_providers: [], profile: { name: "Northwind", summary: "", markets: [], environments: [] }, applications: [payments, hr] },
  ],
};

function fakeMap() {
  let gestures: MapGestures | undefined;
  const engine: MapEngine = (_element, _start, given) => {
    gestures = given;
    return { show: () => undefined, destroy: () => undefined };
  };
  return { load: () => Promise.resolve(engine), click: (point: { lat: number; lng: number }) => act(() => gestures!.click(point)) };
}

function source(overrides: Partial<OnboardingSource> = {}): OnboardingSource {
  return {
    load: vi.fn(async () => setup),
    start: vi.fn(async () => ({ id: "run-startup-0001", project: "startup" })),
    loadProfile: vi.fn(async () => DEFAULT_PROFILE),
    saveProfile: vi.fn(async (profile) => profile),
    listRuns: vi.fn(async () => []),
    ...overrides,
  };
}

async function shown(fake: OnboardingSource, onFollowRun = vi.fn(), loadMap = fakeMap().load) {
  render(<OnboardingSection source={fake} onFollowRun={onFollowRun} loadMap={loadMap} />);
  await screen.findByRole("form", { name: "New run" });
}

const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;

describe("onboarding", () => {
  it("shows the sections in order, with the controls in that order", async () => {
    await shown(source());
    const legends = [...document.querySelectorAll("legend")].map((legend) => legend.textContent);
    expect(legends).toEqual(["1. Connect the infrastructure", "2. Projects", "3. Default focus", "4. Where it may move", "5. On-prem"]);
    const controls = [...document.querySelectorAll("input, button")].map((element) => (element as HTMLInputElement).value || element.textContent);
    expect(controls).toEqual(["floci", "availability", "zone", "performance", "cost", "aws", "managed_pg", "onprem", "Start the run"]);
  });

  it("asks for no estate, and lists the company's projects", async () => {
    await shown(source({ load: vi.fn(async () => company) }));
    expect([...document.querySelectorAll("legend")].map((legend) => legend.textContent).join(" ")).not.toMatch(/estate/i);
    expect(screen.queryByText(/Pick the estate|in this estate/)).toBeNull();
    expect(screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).name === "project")).toHaveLength(0);
    const projects = within(screen.getByRole("list", { name: "Projects" })).getAllByRole("listitem");
    expect(projects.map((item) => item.getAttribute("aria-label"))).toEqual(["Payments API", "HR portal"]);
    expect(screen.getByText("Card payments for the shops")).toBeTruthy();
  });

  it("sends each project on the default focus or its own, with what to do with it next", async () => {
    const fake = source({ load: vi.fn(async () => company) });
    await shown(fake);
    const card = (name: string) => within(screen.getByRole("listitem", { name }));
    expect((card("Payments API").getByLabelText("Focus") as HTMLSelectElement).value).toBe("default");
    expect(card("Payments API").getByRole("option", { name: "Default focus (Cost reduction)" })).toBeTruthy();
    fireEvent.change(card("HR portal").getByLabelText("Focus"), { target: { value: "zone" } });
    fireEvent.change(card("HR portal").getByLabelText("Market"), { target: { value: "de" } });
    fireEvent.change(card("Payments API").getByLabelText("Now, monthly active users"), { target: { value: "60000" } });
    fireEvent.change(card("Payments API").getByLabelText(/What do you want to do with it next/), { target: { value: "Split the card vault out." } });
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    await waitFor(() => expect(fake.start).toHaveBeenCalled());
    expect(fake.start).toHaveBeenCalledWith({
      project: "northwind",
      onboarding: {
        connection: "floci",
        targets: ["aws", "managed_pg"],
        onprem: { wanted: false },
        criteria: DEFAULT_CRITERIA,
        focus_mode: "project",
        applications: [
          { id: "payments", users_now: 60000, users_expected: 190000, at_month: 36, intent: "Split the card vault out." },
          { id: "hr-portal", users_now: 900, users_expected: 1450, at_month: 36, criteria: { focus: "zone", market: "de" } },
        ],
      },
    });
  });

  it("counts the characters only near the limit", async () => {
    await shown(source({ load: vi.fn(async () => company) }));
    const intent = within(screen.getByRole("listitem", { name: "Payments API" })).getByLabelText(/What do you want to do with it next/);
    fireEvent.change(intent, { target: { value: "Short plan." } });
    expect(screen.queryByText(/of 2000 characters/)).toBeNull();
    fireEvent.change(intent, { target: { value: "x".repeat(1900) } });
    expect(screen.getByText("1900 of 2000 characters")).toBeTruthy();
  });

  it("runs with one focus, and a market when the focus is Zones", async () => {
    const fake = source();
    await shown(fake);
    expect((screen.getByRole("radio", { name: /Cost reduction/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Zones/ }));
    fireEvent.change(screen.getByLabelText("Market"), { target: { value: "us" } });
    expect(screen.getByText("us-*")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    await waitFor(() => expect(fake.start).toHaveBeenCalled());
    expect(vi.mocked(fake.start).mock.calls[0][0].onboarding.criteria).toEqual({ focus: "zone", market: "us" });
  });

  it("says whether the infrastructure answers", async () => {
    const connected = { ...setup, connections: [{ id: "floci", label: "AWS (demo estate)", endpoint: "http://localhost:4566", reachable: true }] };
    await shown(source({ load: vi.fn(async () => connected) }));
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("http://localhost:4566")).toBeTruthy();
    cleanup();
    const down = { ...setup, connections: [{ id: "floci", label: "AWS (demo estate)", endpoint: "http://localhost:4566", reachable: false }] };
    await shown(source({ load: vi.fn(async () => down) }));
    expect(screen.getByText("Not reachable")).toBeTruthy();
  });

  it("starts the run with every target ticked and on-prem off by default", async () => {
    const fake = source();
    await shown(fake);
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    await waitFor(() => expect(fake.start).toHaveBeenCalledTimes(1));
    expect(fake.start).toHaveBeenCalledWith({
      project: "startup",
      onboarding: { connection: "floci", targets: ["aws", "managed_pg"], onprem: { wanted: false }, criteria: DEFAULT_CRITERIA },
    });
  });

  it("sends what the owner changed", async () => {
    const fake = source();
    const map = fakeMap();
    await shown(fake, vi.fn(), map.load);
    fireEvent.click(box("Managed Postgres"));
    fireEvent.click(box("Also price a setup of our own"));
    expect((screen.getByRole("button", { name: "Start the run" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {});
    map.click({ lat: 44.43, lng: 26.1 });
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start without saving" }));
    await waitFor(() => expect(fake.start).toHaveBeenCalled());
    expect(fake.start).toHaveBeenCalledWith({
      project: "startup",
      onboarding: { connection: "floci", targets: ["aws"], onprem: { wanted: true }, criteria: DEFAULT_CRITERIA },
    });
  });

  it("keeps the last ticked target ticked", async () => {
    await shown(source());
    fireEvent.click(box("Managed Postgres"));
    expect(box("AWS").disabled).toBe(true);
    expect(box("AWS").checked).toBe(true);
    expect(screen.getByText("At least one target stays ticked")).toBeTruthy();
  });

  it("disables a provider the company forbids", async () => {
    cleanup();
    await shown(source({ load: vi.fn(async () => ({ ...setup, company: "strict" })) }));
    expect(box("Managed Postgres").disabled).toBe(true);
    expect(box("Managed Postgres").checked).toBe(false);
    expect(screen.getByText("Forbidden by the project")).toBeTruthy();
  });

  it("hides on-prem when the catalog has no on-prem option", async () => {
    await shown(source({ load: vi.fn(async () => ({ ...setup, onprem: false })) }));
    expect(screen.queryByText("5. On-prem")).toBeNull();
  });

  it("says there are no projects and keeps Start disabled", async () => {
    await shown(source({ load: vi.fn(async () => ({ ...setup, projects: [] })) }));
    expect(screen.getByText(/No projects yet/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Start the run" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers Retry when the platform is unreachable, and recovers", async () => {
    const load = vi
      .fn<OnboardingSource["load"]>()
      .mockRejectedValueOnce(new OrchestratorError("The platform is unreachable."))
      .mockResolvedValueOnce(setup);
    render(<OnboardingSection source={source({ load })} onFollowRun={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("unreachable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("form", { name: "New run" });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps the answers and shows the reason when the start is refused", async () => {
    const start = vi.fn(async () => Promise.reject(new OrchestratorError("project busy: startup is run-startup-0002")));
    await shown(source({ start }));
    fireEvent.click(box("Managed Postgres"));
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    expect((await screen.findByRole("alert")).textContent).toBe("project busy: startup is run-startup-0002");
    expect(box("Managed Postgres").checked).toBe(false);
    expect((screen.getByRole("button", { name: "Start the run" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("says which run holds the project and why, and opens it", async () => {
    const holder = {
      id: "run-startup-0004",
      project: "startup",
      status: "awaiting_approval" as const,
      step: "present" as const,
      awaiting: "layout" as const,
      revision: 1,
      max_revisions: 2,
      started_at: "2026-11-14T06:00:00Z",
      updated_at: "2026-11-14T06:55:00Z",
    };
    const onFollowRun = vi.fn();
    await shown(source({ listRuns: vi.fn(async () => [holder]) }), onFollowRun);
    const status = await screen.findByText(/is held by/);
    expect(status.textContent).toContain("run-startup-0004, waiting for the layout decision since");
    expect((screen.getByRole("button", { name: "Start the run" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Open run-startup-0004" }));
    expect(onFollowRun).toHaveBeenCalledWith("run-startup-0004");
  });

  it("ignores finished runs of the project", async () => {
    const finished = { id: "run-startup-0001", project: "startup", status: "completed" as const, step: "rehearse" as const, revision: 1, max_revisions: 2, started_at: "", updated_at: "" };
    await shown(source({ listRuns: vi.fn(async () => [finished]) }));
    await waitFor(() => expect(screen.queryByText(/is held by/)).toBeNull());
    expect((screen.getByRole("button", { name: "Start the run" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("opens the started run's page right away", async () => {
    const onFollowRun = vi.fn();
    await shown(source(), onFollowRun);
    fireEvent.click(screen.getByRole("button", { name: "Start the run" }));
    await waitFor(() => expect(onFollowRun).toHaveBeenCalledWith("run-startup-0001"));
    expect(screen.queryByRole("button", { name: "Follow it in Runs" })).toBeNull();
  });
});
