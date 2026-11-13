import run from "../../../../contracts/run.example.json";
import type { Run } from "~/runs/types";

const sampleRun = run as unknown as Run;

export const sampleRuns: readonly Run[] = [sampleRun];
