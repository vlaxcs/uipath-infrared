export function euros(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const text = rounded >= 10000 ? `${Math.round(rounded / 1000)}k` : rounded.toLocaleString("en-US");
  return `€${text}`;
}

export function signedEuros(delta: number): string {
  if (Math.round(delta) === 0) return "±€0";
  return `${delta < 0 ? "−" : "+"}${euros(delta)}`;
}

export function percent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

export function ago(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function span(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  const seconds = ms / 1000;
  if (seconds < 90) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  return `${Math.round(seconds / 60)} min`;
}

export function shortRun(id: string): string {
  const match = /(\d+)$/.exec(id);
  return match ? `#${match[1]}` : id;
}
