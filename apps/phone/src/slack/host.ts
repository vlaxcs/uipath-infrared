export function hostedSlackUrl(search: string): string | null {
  return new URLSearchParams(search).get("slack");
}
