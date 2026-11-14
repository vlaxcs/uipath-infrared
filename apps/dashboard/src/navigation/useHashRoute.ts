import { useCallback, useEffect, useState } from "react";
import { RUN_DATA_SECTIONS, readRoute, routeHash, type Route } from "~/navigation/route";
import type { SectionId } from "~/navigation/sections";

export type HashRoute = Route & {
  selectSection: (section: SectionId) => void;
  pickRun: (runId: string) => void;
  openRun: (runId: string) => void;
  openGate: (runId: string) => void;
  closeRun: () => void;
  closeGate: () => void;
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
    selectSection: (section) =>
      navigate({ section, runId: RUN_DATA_SECTIONS.has(section) ? route.runId : null, focusGate: false }),
    pickRun: (runId) => navigate({ section: route.section, runId, focusGate: false }),
    openRun: (runId) => navigate({ section: "runs", runId, focusGate: false }),
    openGate: (runId) => navigate({ section: "runs", runId, focusGate: true }),
    closeRun: () => navigate({ section: "runs", runId: null, focusGate: false }),
    closeGate: () => navigate({ section: "approvals", runId: null, focusGate: false }),
  };
}
