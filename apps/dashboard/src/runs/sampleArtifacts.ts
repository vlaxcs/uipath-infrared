import candidates from "../../../../contracts/candidates.example.json";
import demoShop from "../../../../contracts/mock/demo-shop.infra.json";
import rehearsal from "../../../../contracts/rehearsal.example.json";
import result from "../../../../contracts/result.example.json";
import { RunSourceError } from "~/runs/source";
import type { RunArtifactInfo } from "~/runs/types";

const artifacts: Readonly<Record<string, unknown>> = {
  "infra.json": demoShop,
  "findings.json": { findings: [] },
  "candidates.0.json": candidates,
  "candidates.1.json": candidates,
  "result.0.json": result,
  "result.1.json": result,
  "rehearsal.json": rehearsal,
  "rehearsal.0.json": rehearsal,
  "rehearsal.1.json": rehearsal,
  "feedback.1.json": {
    revision: 1,
    from_step: "evaluate",
    reason: "the sample run's feedback",
    result: "result.0.json",
    rehearsal: null,
  },
};

export function sampleArtifactInfos(): RunArtifactInfo[] {
  return Object.keys(artifacts).map((path) => ({ path, size: sampleArtifactText(path).length }));
}

export function sampleArtifactText(path: string): string {
  const value = artifacts[path];
  if (value === undefined) throw new RunSourceError(`artifact ${path} not found`, 404);
  return JSON.stringify(value);
}
