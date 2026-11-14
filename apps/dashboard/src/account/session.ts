const SIGNED_OUT = "infrared:signed-out";

const LOGIN_ERRORS: Record<string, string> = {
  state: "Sign-in took too long or your browser blocked its cookie. Try again.",
  denied: "Sign-in was cancelled on GitHub. Approve Infrared to continue.",
  github: "GitHub did not complete the sign-in. Try again.",
  unavailable: "Sign-in is unavailable right now. Try again in a moment.",
};

const UNKNOWN_ERROR = "Sign-in did not complete. Try again.";

export function reportSignedOut(): void {
  window.dispatchEvent(new Event(SIGNED_OUT));
}

export function onSignedOut(listener: () => void): () => void {
  window.addEventListener(SIGNED_OUT, listener);
  return () => window.removeEventListener(SIGNED_OUT, listener);
}

export async function signOut(baseUrl: string, fetcher: typeof fetch = fetch): Promise<void> {
  try {
    await fetcher(`${baseUrl}/auth/logout`, { method: "POST", credentials: "include" });
  } catch {
    return;
  }
}

export function loginError(search: string): string | null {
  const reason = new URLSearchParams(search).get("login_error");
  if (!reason) return null;
  return LOGIN_ERRORS[reason] ?? UNKNOWN_ERROR;
}
