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
