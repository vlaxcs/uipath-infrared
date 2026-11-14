import candidates from "../../../../contracts/candidates.example.json";
import demoShop from "../../../../contracts/mock/demo-shop.infra.json";
import rehearsal from "../../../../contracts/rehearsal.example.json";
import result from "../../../../contracts/result.example.json";
import { RunSourceError } from "~/runs/source";
import type { RunArtifactInfo } from "~/runs/types";

const findings = {
  findings: [
    {
      id: "idle-gpu-nodes",
      title: "The GPU node group is idle",
      category: "delete_idle",
      stack: "compute",
      resources: ["ng-data-gpu"],
      evidence: ["gpu_pct average 0.4", "p95 1.0 over 14 days", "no inbound edges"],
      recommendation: "Delete the GPU node group; the general pool covers the remaining load.",
      confidence: "medium",
      risk: "low",
    },
    {
      id: "orphan-volumes",
      title: "Six EBS volumes are unattached",
      category: "storage_tiering",
      stack: "storage",
      resources: ["ebs-orphans"],
      evidence: ["6 unattached volumes", "zero IOPS for 14 days"],
      recommendation: "Snapshot and delete the orphan volumes.",
      confidence: "high",
      risk: "low",
    },
    {
      id: "erp-residency",
      title: "The ERP database waits for the vendor",
      category: "migrate",
      stack: "data",
      resources: ["rds-erp"],
      evidence: ["hstore and pg_trgm are required by the ERP"],
      recommendation: "Migrate after the vendor confirms neon-launch support.",
      confidence: "low",
      risk: "medium",
      migration_notes: "Not part of this plan; keep the finding open.",
    },
  ],
};

const artifacts: Readonly<Record<string, unknown>> = {
  "infra.json": demoShop,
  "findings.json": findings,
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
