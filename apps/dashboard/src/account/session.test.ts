import { afterEach, describe, expect, it, vi } from "vitest";
import { loginError, onSignedOut, reportSignedOut, signOut } from "~/account/session";

describe("the session", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tells every listener when the orchestrator says the session is gone", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onSignedOut(first);
    const stopSecond = onSignedOut(second);

    reportSignedOut();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    stopFirst();
    reportSignedOut();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    stopSecond();
  });

  it("signs out on the orchestrator with the session cookie", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    await signOut("http://127.0.0.1:8080", fetcher);
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8080/auth/logout", { method: "POST", credentials: "include" });
  });

  it("still resolves when the orchestrator cannot be reached on sign-out", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(signOut("http://127.0.0.1:8080", fetcher)).resolves.toBeUndefined();
  });

  it("explains each reason the sign-in came back with", () => {
    expect(loginError("?login_error=state")).toMatch(/took too long|cookies/i);
    expect(loginError("?login_error=denied")).toMatch(/cancelled|approve/i);
    expect(loginError("?login_error=github")).toMatch(/GitHub/);
    expect(loginError("?login_error=unavailable")).toMatch(/unavailable|try again/i);
    expect(loginError("?login_error=made-up")).toMatch(/try again/i);
    expect(loginError("")).toBeNull();
  });
});
