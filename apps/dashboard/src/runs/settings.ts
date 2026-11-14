export type DashboardSettings = {
  orchestratorUrl: string | null;
};

export function readSettings(env: Record<string, string | undefined>): DashboardSettings {
  const raw = env.VITE_ORCHESTRATOR_URL?.trim();
  return { orchestratorUrl: raw ? raw.replace(/\/+$/, "") : null };
}

export const settings = readSettings(import.meta.env as Record<string, string | undefined>);
