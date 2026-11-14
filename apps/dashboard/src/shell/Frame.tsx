import { ChevronLeft, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { PLAN_LABELS, type Account } from "~/account/accountSource";
import iconUrl from "~/assets/infrared-icon.svg";
import { CreditMarks } from "~/credits/CreditMarks";
import type { PageId } from "~/navigation/route";
import { AccountMenu } from "~/shell/AccountMenu";

type FrameProps = {
  showBack: boolean;
  title: string | null;
  account: Account | null;
  onBack: () => void;
  onHome: () => void;
  onNavigate: (page: PageId) => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  children: ReactNode;
};

export function Frame({ showBack, title, account, onBack, onHome, onNavigate, onDisconnect, onRefresh, children }: FrameProps) {
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
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <span className="h-9 w-9" aria-hidden="true" />
          )}
          <button type="button" onClick={onHome} aria-label="Infrared home" className="flex items-center gap-2 rounded-control px-2 py-1">
            <img src={iconUrl} alt="" className="h-8 w-8" />
            <span className="text-title font-semibold tracking-tight">Infrared</span>
          </button>
          {title ? (
            <>
              <span className="text-title text-fg-subtle" aria-hidden="true">|</span>
              <h1 className="px-2 text-title font-medium tracking-tight text-fg">{title}</h1>
            </>
          ) : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          {account ? (
            <div className="flex items-center gap-3 rounded-pill border border-border bg-surface px-3 py-1.5">
              <CreditMarks credits={account.credits} />
              <span className="text-label text-fg-muted">{PLAN_LABELS[account.plan]}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-control border border-border bg-surface text-fg hover:bg-surface-muted"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <AccountMenu login={account?.login} avatarUrl={account?.avatarUrl} onNavigate={onNavigate} onDisconnect={onDisconnect} />
        </div>
      </header>
      <main className="px-4 pb-24 pt-20">{children}</main>
    </div>
  );
}
