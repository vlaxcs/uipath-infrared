const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatTimestamp(timestamp: string): string {
  return formatter.format(new Date(timestamp));
}
