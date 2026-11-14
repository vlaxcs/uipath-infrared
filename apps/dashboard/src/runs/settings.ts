export type DashboardSettings = {
  orchestratorUrl: string | null;
  extensionUrl: string | null;
};

export function readSettings(env: Record<string, string | undefined>): DashboardSettings {
  const raw = env.VITE_ORCHESTRATOR_URL?.trim();
  const extension = env.VITE_CHROME_EXTENSION_URL?.trim();
  return { orchestratorUrl: raw ? raw.replace(/\/+$/, "") : null, extensionUrl: extension || null };
}

export const settings = readSettings(import.meta.env as Record<string, string | undefined>);
