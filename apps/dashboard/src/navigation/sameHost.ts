const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function sameHostUrl(current: string, orchestratorUrl: string | null): string | null {
  if (!orchestratorUrl) return null;
  try {
    const page = new URL(current);
    const orchestrator = new URL(orchestratorUrl);
    if (page.hostname === orchestrator.hostname) return null;
    if (!LOOPBACK.has(page.hostname) || !LOOPBACK.has(orchestrator.hostname)) return null;
    page.hostname = orchestrator.hostname;
    return page.toString();
  } catch {
    return null;
  }
}
