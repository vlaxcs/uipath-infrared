import { useCallback, useEffect, useState } from "react";
import { readRoute, routeHash, type Route } from "~/navigation/route";
import type { SectionId } from "~/navigation/sections";

export type HashRoute = Route & {
  selectSection: (section: SectionId) => void;
  openRun: (runId: string) => void;
  closeRun: () => void;
};

export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<Route>(() => readRoute(window.location.hash));

  useEffect(() => {
    const sync = () => setRoute(readRoute(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = routeHash(next);
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute(next);
  }, []);

  return {
    ...route,
    selectSection: (section) => navigate({ section, runId: null }),
    openRun: (runId) => navigate({ section: "runs", runId }),
    closeRun: () => navigate({ section: "runs", runId: null }),
  };
}
