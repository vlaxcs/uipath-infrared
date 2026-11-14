import type { ReactNode } from "react";
import iconUrl from "~/assets/infrared-icon.svg";
import { CreditMarks } from "~/credits/CreditMarks";
import type { PageId } from "~/navigation/route";
import { AccountMenu } from "~/shell/AccountMenu";

type FrameProps = {
  showBack: boolean;
  credits: number | null;
  login?: string | null;
  avatarUrl?: string | null;
  onBack: () => void;
  onHome: () => void;
  onNavigate: (page: PageId) => void;
  onDisconnect: () => void;
  children: ReactNode;
};

export function Frame({ showBack, credits, login, avatarUrl, onBack, onHome, onNavigate, onDisconnect, children }: FrameProps) {
  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center justify-between gap-4 p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-pill border border-border bg-surface text-fg hover:bg-surface-muted"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
          <button type="button" onClick={onHome} aria-label="Infrared home" className="flex items-center gap-2 rounded-control px-2 py-1">
            <img src={iconUrl} alt="" className="h-8 w-8" />
            <span className="text-title font-semibold tracking-tight">Infrared</span>
          </button>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          {credits !== null ? <CreditMarks credits={credits} /> : null}
          <AccountMenu login={login} avatarUrl={avatarUrl} onNavigate={onNavigate} onDisconnect={onDisconnect} />
        </div>
      </header>
      <main className="px-4 pb-10 pt-20 lg:px-8">{children}</main>
    </div>
  );
}
