export type InfraStatus = "active" | "idle" | "orphan";
export type GraphStatus = InfraStatus | "unknown";
export type GraphCategory = "compute" | "data" | "storage" | "messaging" | "network" | "edge" | "other";
export type EdgeKind = "network" | "data" | "event" | "traffic" | "dns" | "config" | "contains" | "other";

export type StaticMetric = {
  value: number;
  unit?: string | null;
  provenance?: string | null;
  basis?: string | null;
  [key: string]: unknown;
};

export type SeriesMetric = {
  unit?: string | null;
  window_days?: number | null;
  provenance?: string | null;
  min?: number;
  avg?: number;
  p50?: number;
  p95?: number;
  max?: number;
  sum?: number;
  [key: string]: unknown;
};

export type InfraStack = {
  id: string;
  name?: string | null;
  environment?: string | null;
  [key: string]: unknown;
};

export type InfraComponent = {
  id: string;
  name?: string | null;
  kind: string;
  stack?: string | null;
  status?: string | null;
  region?: string | null;
  zones?: number | null;
  parent?: string | null;
  quantity?: number | null;
  config?: Record<string, unknown> | null;
  capacity?: Record<string, StaticMetric> | null;
  usage?: Record<string, SeriesMetric> | null;
  cost?: { monthly_eur?: StaticMetric | null; [key: string]: unknown } | null;
  security?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type InfraEdge = {
  id?: string | null;
  from: string;
  to: string;
  kind: string;
  evidence?: string | null;
  gb_month?: StaticMetric | null;
  latency_sensitive?: boolean | null;
  note?: string | null;
  [key: string]: unknown;
};

export type InfraContract = {
  schema_version?: string;
  project: string;
  source?: { is_mock?: boolean; generated_at?: string; [key: string]: unknown } | null;
  stacks?: InfraStack[] | null;
  components: InfraComponent[];
  edges: InfraEdge[];
  [key: string]: unknown;
};

export type GraphNode = {
  id: string;
  label: string;
  kind: string;
  category: GraphCategory;
  stackId: string;
  status: GraphStatus;
  degree: number;
  component: InfraComponent;
};

export type GraphEdge = {
  key: string;
  from: string;
  to: string;
  kind: EdgeKind;
  evidence?: string;
  gbMonth?: StaticMetric;
  latencySensitive?: boolean;
  note?: string;
};

export type GraphStack = {
  id: string;
  label: string;
  count: number;
};

export type GraphModel = {
  project: string;
  generatedAt?: string;
  isMock: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stacks: GraphStack[];
};
