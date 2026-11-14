const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const euroFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatTimestamp(timestamp: string): string {
  return dateTimeFormatter.format(new Date(timestamp));
}

export function formatEUR(value?: number | null): string {
  if (value === undefined || value === null) return "—";
  return euroFormatter.format(value);
}

export function formatHours(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(1))} h/mo`;
}
