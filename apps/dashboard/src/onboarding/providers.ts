const PROVIDER_LABELS: Record<string, string> = {
  aws: "AWS",
  gcp: "Google Cloud",
  azure: "Azure",
  supabase: "Supabase",
  neon: "Neon",
  hetzner: "Hetzner",
  fly: "Fly.io",
  cloudflare: "Cloudflare R2",
  backblaze: "Backblaze B2",
  runpod: "RunPod",
  managed_pg: "Managed Postgres",
  other: "Other providers",
};

export function providerLabel(id: string): string {
  return PROVIDER_LABELS[id] ?? id;
}
