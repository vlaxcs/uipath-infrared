import { useCallback, useEffect, useState } from "react";
import { isLegacyHash, pathWithin, readRoute, routePath, type PageId, type Route } from "~/navigation/route";

export type AppRoute = Route & {
  go: (page: PageId) => void;
  openRun: (runId: string) => void;
  openGate: (runId: string) => void;
  closeRun: () => void;
  back: () => void;
};

const BASE = import.meta.env.BASE_URL;

function currentRoute(): Route {
  if (isLegacyHash(window.location.hash)) {
    const route = readRoute(window.location.hash);
    window.history.replaceState(null, "", BASE + routePath(route) + window.location.search);
    return route;
  }
  return readRoute(pathWithin(window.location.pathname, BASE));
}

export function useRoute(): AppRoute {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    const sync = () => setRoute(currentRoute());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const navigate = useCallback((next: Route) => {
    const url = BASE + routePath(next);
    if (window.location.pathname !== url) {
      window.history.pushState(null, "", url);
      setDepth((current) => current + 1);
    }
    setRoute(next);
  }, []);

  const back = useCallback(() => {
    if (depth > 0) {
      setDepth((current) => current - 1);
      window.history.back();
      return;
    }
    navigate(route.page === "runs" && route.runId ? { page: "runs", runId: null, focusGate: false } : { page: "home", runId: null, focusGate: false });
  }, [depth, navigate, route.page, route.runId]);

  return {
    ...route,
    go: (page) => navigate({ page, runId: null, focusGate: false }),
    openRun: (runId) => navigate({ page: "runs", runId, focusGate: false }),
    openGate: (runId) => navigate({ page: "runs", runId, focusGate: true }),
    closeRun: () => navigate({ page: "runs", runId: null, focusGate: false }),
    back,
  };
}
