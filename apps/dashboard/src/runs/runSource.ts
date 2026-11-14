import { createHttpRunSource } from "~/runs/httpRunSource";
import { sampleRunSource } from "~/runs/sampleRunSource";
import { settings } from "~/runs/settings";
import type { RunSource } from "~/runs/source";

export const START_PROJECT = "startup";

export const runSource: RunSource = settings.orchestratorUrl
  ? createHttpRunSource(settings.orchestratorUrl)
  : sampleRunSource;
