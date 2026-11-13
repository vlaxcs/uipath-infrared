import { buildGraphModel } from "~/graph/model";
import type { InfraContract } from "~/graph/types";

import infra from "../../../../contracts/mock/startup.infra.json";

export const sampleInfra = infra as unknown as InfraContract;

export const sampleGraphModel = buildGraphModel(sampleInfra);
