import type { RehearsalDocument } from "~/rehearsal/types";

import failed from "../../../../apps/sandbox/sample/rehearsal.json";
import example from "../../../../contracts/rehearsal.example.json";

// The contract sample is the passed demo path the orchestrator's flow test uses.
export const sampleRehearsal = example as unknown as RehearsalDocument;
// The sandbox's real output for the start-up project: failed verdict, revise, x_ blocks.
export const failedRehearsal = failed as unknown as RehearsalDocument;
