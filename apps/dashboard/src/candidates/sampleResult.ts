import type { ResultDocument } from "~/candidates/types";

import realResult from "../../../../apps/orchestrator/testdata/flow/result.1.json";
import example from "../../../../contracts/result.example.json";
import nothingFeasible from "../../../../contracts/result.example.nothing-feasible.json";

// The orchestrator's flow test keeps this real engine output for the start-up
// project; the contract examples are hand-written alternate states.
export const sampleResult = realResult as unknown as ResultDocument;
export const exampleResult = example as unknown as ResultDocument;
export const nothingFeasibleResult = nothingFeasible as unknown as ResultDocument;
