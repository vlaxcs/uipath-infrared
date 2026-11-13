const KEY = "netpot:scroll";

export function rememberScroll(y: number) {
  try {
    sessionStorage.setItem(KEY, String(Math.round(y)));
  } catch {
    return;
  }
}

export function takeRememberedScroll(): number | null {
  try {
    const stored = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const y = Number(stored);
    return stored !== null && Number.isFinite(y) && y >= 0 ? y : null;
  } catch {
    return null;
  }
}
