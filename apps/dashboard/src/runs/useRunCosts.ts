import { useEffect, useRef, useState } from "react";
import { parseArtifact } from "~/runs/artifactParse";
import { emptyCost, latestResultPath, runCostFromResult, type RunCost } from "~/runs/runCosts";
import type { RunSource } from "~/runs/source";
import type { RunSummary } from "~/runs/types";

export type RunCostEntry = RunCost | "loading";
export type RunCosts = Record<string, RunCostEntry>;

export function useRunCosts(source: RunSource, runs: readonly RunSummary[]): RunCosts {
  const [costs, setCosts] = useState<RunCosts>({});
  const cache = useRef(new Map<string, RunCost>());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const store = (id: string, key: string, cost: RunCost) => {
      cache.current.set(key, cost);
      if (cancelled) return;
      setCosts((current) => (current[id] === cost ? current : { ...current, [id]: cost }));
    };

    const load = async (id: string, key: string) => {
      try {
        const files = await source.listFiles(id, controller.signal);
        const latest = latestResultPath(files.map((file) => file.path));
        if (!latest) {
          store(id, key, emptyCost());
          return;
        }
        const text = await source.readArtifact(id, latest, controller.signal);
        const parsed = parseArtifact(text);
        store(id, key, parsed.ok ? runCostFromResult(parsed.value) : emptyCost());
      } catch {
        if (controller.signal.aborted) return;
        store(id, key, emptyCost());
      }
    };

    for (const run of runs) {
      const key = `${run.id}:${run.status}:${run.step}:${run.revision}`;
      const cached = cache.current.get(key);
      if (cached) {
        setCosts((current) => (current[run.id] === cached ? current : { ...current, [run.id]: cached }));
        continue;
      }
      setCosts((current) => (current[run.id] === "loading" ? current : { ...current, [run.id]: "loading" }));
      void load(run.id, key);
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [source, runs]);

  return costs;
}
