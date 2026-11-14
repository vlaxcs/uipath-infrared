export type PageId = "home" | "analyze" | "runs" | "configuration" | "account" | "login";

export type Route = {
  page: PageId;
  runId: string | null;
  focusGate: boolean;
};

const PAGES = new Set<string>(["analyze", "runs", "configuration", "account", "login"]);

export function readRoute(path: string): Route {
  const parts = path.replace(/^#?\/?/, "").split("/").filter(Boolean);
  const page: PageId = parts[0] !== undefined && PAGES.has(parts[0]) ? (parts[0] as PageId) : "home";
  const runId = page === "runs" && parts[1] ? decode(parts[1]) : null;
  return { page, runId, focusGate: runId !== null && parts[2] === "gate" };
}

export function routePath(route: Route): string {
  if (route.page === "home") return "";
  const run = route.page === "runs" && route.runId ? `/${encodeURIComponent(route.runId)}` : "";
  const gate = run && route.focusGate ? "/gate" : "";
  return `${route.page}${run}${gate}`;
}

export function parentOf(route: Route): Route {
  if (route.page === "runs" && route.runId) return { page: "runs", runId: null, focusGate: false };
  return { page: "home", runId: null, focusGate: false };
}

export function isLegacyHash(hash: string): boolean {
  return hash.startsWith("#/");
}

export function pathWithin(pathname: string, base: string): string {
  return pathname.startsWith(base) ? pathname.slice(base.length) : "";
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
