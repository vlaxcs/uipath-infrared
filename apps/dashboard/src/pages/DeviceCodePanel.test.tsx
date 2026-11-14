import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDeviceSignIn, type DevicePoll, type DeviceSignIn } from "~/account/deviceSignIn";
import { DeviceCodePanel } from "~/pages/DeviceCodePanel";

const code = { userCode: "WDJB-MJHT", verificationUri: "https://github.com/login/device", expiresIn: 900, interval: 5 };

function signInPolling(...answers: DevicePoll[]): DeviceSignIn {
  const poll = vi.fn<() => Promise<DevicePoll>>();
  for (const answer of answers) poll.mockResolvedValueOnce(answer);
  poll.mockResolvedValue("pending");
  return { start: vi.fn(async () => code), poll };
}

async function startWith(signIn: DeviceSignIn, onSignedIn = vi.fn()) {
  render(<DeviceCodePanel signIn={signIn} onSignedIn={onSignedIn} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));
  });
  return onSignedIn;
}

async function advance(seconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(seconds * 1000);
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("signing in with a GitHub code", () => {
  it("shows the code and where to enter it", async () => {
    await startWith(signInPolling());
    expect(screen.getByLabelText("Sign-in code").textContent).toBe("WDJB-MJHT");
    expect(screen.getByRole("link", { name: "Open GitHub" }).getAttribute("href")).toBe("https://github.com/login/device");
    expect(screen.getByText(/expires in 15:00/)).toBeTruthy();
  });

  it("empties the bar under the code as the time runs out", async () => {
    await startWith(signInPolling());
    const bar = screen.getByRole("progressbar", { name: "Time left on the code" });
    expect(bar.getAttribute("aria-valuenow")).toBe("900");
    expect(bar.querySelector("rect")!.getAttribute("width")).toBe("100%");
    await advance(450);
    expect(bar.getAttribute("aria-valuenow")).toBe("450");
    expect(bar.getAttribute("aria-valuetext")).toBe("7:30");
    expect(bar.querySelector("rect")!.getAttribute("width")).toBe("50%");
  });

  it("copies the code from the icon inside its box", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await startWith(signInPolling());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy the sign-in code" }));
    });
    expect(writeText).toHaveBeenCalledWith("WDJB-MJHT");
    expect(screen.getByText(/Code copied/).getAttribute("role")).toBe("status");
  });

  it("polls at GitHub's interval and signs in once the code is approved", async () => {
    const signIn = signInPolling("pending", "signed_in");
    const onSignedIn = await startWith(signIn);
    await advance(4);
    expect(signIn.poll).not.toHaveBeenCalled();
    await advance(1);
    expect(signIn.poll).toHaveBeenCalledTimes(1);
    await advance(5);
    expect(signIn.poll).toHaveBeenCalledTimes(2);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it("waits five seconds longer after GitHub says to slow down", async () => {
    const signIn = signInPolling("slow_down");
    await startWith(signIn);
    await advance(5);
    expect(signIn.poll).toHaveBeenCalledTimes(1);
    await advance(9);
    expect(signIn.poll).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(signIn.poll).toHaveBeenCalledTimes(2);
  });

  it("offers a new code when this one is denied or expired", async () => {
    await startWith(signInPolling("denied"));
    await advance(5);
    expect(screen.getByRole("alert").textContent).toMatch(/cancelled on GitHub/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("says why when GitHub gives no code", async () => {
    const signIn: DeviceSignIn = { start: vi.fn(async () => Promise.reject(new Error("check that the GitHub App has Device Flow enabled"))), poll: vi.fn() };
    await startWith(signIn);
    expect(screen.getByRole("alert").textContent).toMatch(/Device Flow/);
  });

  it("stops polling once it leaves the page", async () => {
    const signIn = signInPolling();
    await startWith(signIn);
    cleanup();
    await advance(30);
    expect(signIn.poll).not.toHaveBeenCalled();
  });
});

describe("the device sign-in client", () => {
  it("posts with the session cookie and reads the code", async () => {
    vi.useRealTimers();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 }))) as unknown as typeof fetch;
    const started = await createDeviceSignIn("http://127.0.0.1:8080", fetcher).start();
    expect(started).toEqual(code);
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8080/auth/device", { method: "POST", credentials: "include" });
  });

  it("passes the orchestrator's reason through", async () => {
    vi.useRealTimers();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "Device Flow is off" }), { status: 502 })) as unknown as typeof fetch;
    await expect(createDeviceSignIn("http://x", fetcher).start()).rejects.toThrow("Device Flow is off");
  });
});

describe("a lost device cookie", () => {
  it("is not reported as an expired code", async () => {
    await startWith(signInPolling("no_cookie"));
    await advance(5);
    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert).not.toMatch(/expired/);
    expect(alert).toMatch(/cookie/);
  });
});
