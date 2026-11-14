import { useCallback, useEffect, useState } from "react";
import { readRoute, routeHash, type PageId, type Route } from "~/navigation/route";

export type HashRoute = Route & {
  go: (page: PageId) => void;
  openRun: (runId: string) => void;
  openGate: (runId: string) => void;
  closeRun: () => void;
  back: () => void;
};

export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<Route>(() => readRoute(window.location.hash));
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    const sync = () => setRoute(readRoute(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = routeHash(next);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
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
