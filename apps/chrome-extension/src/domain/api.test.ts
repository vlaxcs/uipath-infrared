import { describe, expect, it } from "vitest";
import result from "../../../../contracts/result.example.json";
import runExample from "../../../../contracts/run.example.json";
import { loadLatest, NoRunsError, type FetchLike } from "~/domain/api";
import type { RunDetail } from "~/domain/types";

const detail = runExample as unknown as RunDetail;
const BASE = "http://host";
const RUN_URL = `${BASE}/runs/${encodeURIComponent(detail.id)}`;

type FakeResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function response(status: number, body: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function fakeFetch(routes: Record<string, () => FakeResponse>): { calls: string[]; fetchImpl: FetchLike } {
  const calls: string[] = [];
  return {
    calls,
    fetchImpl: async (url: string) => {
      calls.push(url);
      const route = routes[url];
      return (route ? route() : response(404, { error: "not found" })) as unknown as Response;
    },
  };
}

const baseRoutes = () => ({
  [`${BASE}/runs?limit=1`]: () => response(200, [detail]),
  [RUN_URL]: () => response(200, detail),
  [`${RUN_URL}/files/result.1.json`]: () => response(200, result),
  [`${RUN_URL}/files/infra.json`]: () =>
    response(200, {
      ci_runners: {
        source_repo: "vlaxcs/uipath-infrared",
        runners: [{ runner_type: "self-hosted", hours_month: 3, workflow_runs: 8 }],
      },
    }),
});

describe("loading the latest run", () => {
  it("reads the summary, the run, its artifacts and the runner usage", async () => {
    const { fetchImpl } = fakeFetch(baseRoutes());
    const latest = await loadLatest(BASE, fetchImpl);

    expect(latest).toMatchObject({
      id: detail.id,
      project: detail.project,
      status: "completed",
      step: "rehearse",
      revision: 1,
      maxRevisions: 2,
      before: 133308,
      after: 74365,
      winner: "consolidate",
      pickedLayout: "managed_services",
      runnerSourceRepo: "vlaxcs/uipath-infrared",
    });
    expect(latest.steps.map((entry) => entry.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
      "done",
    ]);
    expect(latest.runners).toHaveLength(1);
  });

  it("keeps the run when the optional artifacts are missing", async () => {
    const routes = baseRoutes();
    delete (routes as Record<string, unknown>)[`${RUN_URL}/files/result.1.json`];
    delete (routes as Record<string, unknown>)[`${RUN_URL}/files/infra.json`];

    const latest = await loadLatest(BASE, fakeFetch(routes).fetchImpl);

    expect(latest.before).toBeNull();
    expect(latest.after).toBeNull();
    expect(latest.runners).toEqual([]);
    expect(latest.runnerNote).toBe("No GitHub Actions runner data in this run.");
  });

  it("treats invalid artifact JSON as unavailable", async () => {
    const routes = baseRoutes();
    routes[`${RUN_URL}/files/result.1.json`] = () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    });

    const latest = await loadLatest(BASE, fakeFetch(routes).fetchImpl);
    expect(latest.before).toBeNull();
    expect(latest.after).toBeNull();
  });

  it("reports when there are no runs", async () => {
    const { fetchImpl } = fakeFetch({ [`${BASE}/runs?limit=1`]: () => response(200, []) });
    await expect(loadLatest(BASE, fetchImpl)).rejects.toBeInstanceOf(NoRunsError);
    await expect(loadLatest(BASE, fetchImpl)).rejects.toMatchObject({ message: "No runs yet" });
  });

  it("surfaces the orchestrator error", async () => {
    const { fetchImpl } = fakeFetch({
      [`${BASE}/runs?limit=1`]: () => response(500, { error: "the engine is down" }),
    });
    await expect(loadLatest(BASE, fetchImpl)).rejects.toMatchObject({
      message: "the engine is down",
      status: 500,
    });
  });
});
