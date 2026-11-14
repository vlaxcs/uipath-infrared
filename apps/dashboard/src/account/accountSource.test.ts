import { describe, expect, it, vi } from "vitest";
import { createHttpAccountSource } from "~/account/accountSource";
import { onSignedOut } from "~/account/session";

function answering(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("the account from the orchestrator", () => {
  it("reads the user, the runs left and the plan from /me, with the session cookie", async () => {
    const fetcher = answering(200, { login: "vlaxcs", avatar_url: "https://avatars.test/v", credits: 4, plan: "run_pack" });
    const account = await createHttpAccountSource("http://127.0.0.1:8090", fetcher).load();
    expect(account).toEqual({ login: "vlaxcs", avatarUrl: "https://avatars.test/v", credits: 4, plan: "run_pack" });
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8090/me", expect.objectContaining({ credentials: "include" }));
  });

  it("has no account when the orchestrator does not answer /me", async () => {
    expect(await createHttpAccountSource("http://x", answering(404, { error: "not found" })).load()).toBeNull();
    expect(await createHttpAccountSource("http://x", answering(401, { error: "no session" })).load()).toBeNull();
  });

  it("reports a signed-out session on 401, and only on 401", async () => {
    const signedOut = vi.fn();
    const stop = onSignedOut(signedOut);
    await createHttpAccountSource("http://x", answering(404, { error: "not found" })).load();
    expect(signedOut).not.toHaveBeenCalled();
    await createHttpAccountSource("http://x", answering(401, { error: "sign in first" })).load();
    expect(signedOut).toHaveBeenCalledTimes(1);
    stop();
  });
});
