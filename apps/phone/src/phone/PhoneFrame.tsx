import { useEffect, useState, type ReactNode } from "react";
import * as Icon from "~/phone/icons";

const CLOCK_TICK_MS = 15000;

function formatClock(date: Date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="hidden h-[52px] shrink-0 items-center justify-between px-8 pt-1 bezel:flex" aria-hidden="true" data-testid="status-bar">
      <span className="w-16 text-base font-semibold">{formatClock(now)}</span>
      <span className="flex items-center gap-1.5"><Icon.Signal /><Icon.Wifi /><Icon.Battery /></span>
    </div>
  );
}

export function PhoneFrame({ children }: { children?: ReactNode }) {
  return (
    <main className="flex h-dvh flex-col bg-surface hosted:bg-transparent bezel:items-center bezel:justify-center bezel:py-6">
      <div className="relative flex min-h-0 flex-1 flex-col bezel:h-[min(852px,calc(100dvh-3rem))] bezel:w-[418px] bezel:flex-none bezel:rounded-[3.4rem] bezel:bg-frame bezel:p-[11px] bezel:shadow-2xl hosted:shadow-none hosted:[-webkit-app-region:drag]">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background bezel:rounded-[2.7rem]">
          <span className="absolute left-1/2 top-[11px] z-10 hidden h-[33px] w-[118px] -translate-x-1/2 rounded-full bg-black bezel:block" aria-hidden="true" />
          <StatusBar />
          <div className="phone-screen relative flex min-h-0 flex-1 flex-col overflow-y-auto hosted:[-webkit-app-region:no-drag]">{children}</div>
          <span className="pointer-events-none absolute bottom-2 left-1/2 hidden h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-foreground bezel:block" aria-hidden="true" />
        </div>
      </div>
    </main>
  );
}
