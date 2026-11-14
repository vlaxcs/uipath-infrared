import type { ResultDocument } from "~/candidates/types";

import example from "../../../../contracts/result.example.json";
import nothingFeasible from "../../../../contracts/result.example.nothing-feasible.json";

export const sampleResult = example as unknown as ResultDocument;
export const nothingFeasibleResult = nothingFeasible as unknown as ResultDocument;
