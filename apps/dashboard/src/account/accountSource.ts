import { reportSignedOut } from "~/account/session";

export type Plan = "run_pack" | "subscription";

export type Account = {
  login: string | null;
  avatarUrl: string | null;
  credits: number;
  plan: Plan;
};

export type AccountSource = {
  load(signal?: AbortSignal): Promise<Account | null>;
};

export const PLAN_LABELS: Record<Plan, string> = { run_pack: "Run pack", subscription: "Subscription" };

export const sampleAccount: Account = { login: null, avatarUrl: null, credits: 5, plan: "run_pack" };

export const sampleAccountSource: AccountSource = { load: async () => sampleAccount };

type MeDocument = { login?: string; avatar_url?: string; credits?: number; plan?: Plan };

export function createHttpAccountSource(baseUrl: string, fetcher: typeof fetch = fetch): AccountSource {
  return {
    async load(signal) {
      const response = await fetcher(`${baseUrl}/me`, { credentials: "include", signal });
      if (response.status === 401) reportSignedOut();
      if (!response.ok) return null;
      const me = (await response.json()) as MeDocument;
      if (typeof me.credits !== "number") return null;
      return { login: me.login ?? null, avatarUrl: me.avatar_url ?? null, credits: me.credits, plan: me.plan === "subscription" ? "subscription" : "run_pack" };
    },
  };
}
