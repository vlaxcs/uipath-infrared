export type DeviceCode = {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

export type DevicePoll = "pending" | "slow_down" | "expired" | "denied" | "no_cookie" | "signed_in";

export type DeviceSignIn = {
  start(): Promise<DeviceCode>;
  poll(): Promise<DevicePoll>;
};

const POLLS = new Set<DevicePoll>(["pending", "slow_down", "expired", "denied", "no_cookie", "signed_in"]);

export function createDeviceSignIn(baseUrl: string, fetcher: typeof fetch = fetch): DeviceSignIn {
  const post = async (path: string) => {
    const response = await fetcher(`${baseUrl}${path}`, { method: "POST", credentials: "include" });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      throw new Error(typeof body?.error === "string" ? body.error : `The platform answered ${response.status}.`);
    }
    return body ?? {};
  };

  return {
    async start() {
      const body = await post("/auth/device");
      if (typeof body.user_code !== "string" || typeof body.verification_uri !== "string") {
        throw new Error("GitHub did not give a sign-in code.");
      }
      return {
        userCode: body.user_code,
        verificationUri: body.verification_uri,
        expiresIn: typeof body.expires_in === "number" ? body.expires_in : 900,
        interval: typeof body.interval === "number" ? body.interval : 5,
      };
    },
    async poll() {
      const body = await post("/auth/device/poll");
      const status = body.status as DevicePoll;
      if (!POLLS.has(status)) throw new Error("The platform sent an unknown sign-in state.");
      return status;
    },
  };
}
