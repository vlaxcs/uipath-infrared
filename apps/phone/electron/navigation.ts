const HOSTS_INSIDE_THE_PHONE = ["slack.com", "slack-edge.com", "accounts.google.com", "appleid.apple.com"];

function parse(address: string): URL | null {
  try {
    return new URL(address);
  } catch {
    return null;
  }
}

export function staysInPhone(address: string): boolean {
  const url = parse(address);
  if (!url || url.protocol !== "https:") return false;
  return HOSTS_INSIDE_THE_PHONE.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

export function opensInBrowser(address: string): boolean {
  const url = parse(address);
  return url !== null && (url.protocol === "https:" || url.protocol === "http:") && !staysInPhone(address);
}
