import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OptionsApp } from "~/options/OptionsApp";
import { DEFAULT_SETTINGS } from "~/storage";

let store: Map<string, unknown>;
let request: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = new Map();
  request = vi.fn(async () => true);
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (keys: string[]) =>
          Object.fromEntries(keys.map((key) => [key, store.get(key)])),
        set: async (values: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(values)) store.set(key, value);
        },
      },
    },
    permissions: { request, contains: vi.fn(async () => true) },
  });
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => [{}],
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderOptions() {
  render(<OptionsApp />);
  await screen.findByRole("button", { name: "Connect" });
}

function setOrchestrator(value: string) {
  fireEvent.change(screen.getByLabelText("Orchestrator URL"), { target: { value } });
}

describe("the connect page", () => {
  it("connects to the local demo without asking for a host permission", async () => {
    await renderOptions();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText(/Connected — 1 run found/)).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/runs?limit=1",
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(store.get("orchestratorUrl")).toBe("http://127.0.0.1:8080");
  });

  it("asks for access to a hosted HTTPS orchestrator", async () => {
    await renderOptions();
    setOrchestrator("https://infrared.example.com/");
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith({ origins: ["https://infrared.example.com/*"] }),
    );
    expect(await screen.findByText(/Connected — 1 run found/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://infrared.example.com/runs?limit=1",
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(store.get("orchestratorUrl")).toBe("https://infrared.example.com");
  });

  it("stops when Chrome denies the host permission", async () => {
    request.mockResolvedValueOnce(false);
    await renderOptions();
    setOrchestrator("https://infrared.example.com");
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("did not grant access");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it("rejects an insecure remote orchestrator", async () => {
    await renderOptions();
    setOrchestrator("http://example.com");
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("https");
    expect(request).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can reset to the local demo", async () => {
    await renderOptions();
    setOrchestrator("https://infrared.example.com");
    fireEvent.click(screen.getByRole("button", { name: "Use local demo" }));

    expect(await screen.findByText(/Using the local demo/)).toBeTruthy();
    expect(store.get("orchestratorUrl")).toBe(DEFAULT_SETTINGS.orchestratorUrl);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
