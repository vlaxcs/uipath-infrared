import type { RunDetail } from "~/runs/types";

import run from "../../../../contracts/run.example.json";

export const sampleRun = run as unknown as RunDetail;

export const sampleRuns: readonly RunDetail[] = [sampleRun];
