const PROVIDER_LABELS: Record<string, string> = {
  aws: "AWS",
  gcp: "Google Cloud",
  azure: "Azure",
  managed_pg: "Managed Postgres",
  other: "Other providers (Hetzner, Fly.io, R2 and more)",
};

export function providerLabel(id: string): string {
  return PROVIDER_LABELS[id] ?? id;
}
