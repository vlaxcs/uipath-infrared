export function eur(value: number): string {
  return `€${Math.round(value).toLocaleString('en-US')}`;
}

export function compactEur(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return eur(value);
}

export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
