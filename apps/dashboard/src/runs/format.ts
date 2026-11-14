const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatTimestamp(timestamp: string): string {
  return dateTimeFormatter.format(new Date(timestamp));
}

export function formatTime(timestamp: string): string {
  return timeFormatter.format(new Date(timestamp));
}

export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}

export function formatEUR(value?: number | null): string {
  if (value === undefined || value === null) return "Not reported";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value?: number | null): string {
  if (value === undefined || value === null) return "Not reported";
  return `${Number(value.toFixed(2))}%`;
}

export function formatRisk(value?: number | null): string {
  if (value === undefined || value === null) return "Not reported";
  return value.toFixed(2);
}
