import type { ReactNode } from "react";
import type { SectionId } from "~/navigation/sections";
import { Brand } from "~/shell/Brand";
import { SidebarNav } from "~/shell/SidebarNav";
import { TopBar } from "~/shell/TopBar";

type AppShellProps = {
  activeSection: SectionId;
  onSelectSection: (id: SectionId) => void;
  title: string;
  headerBadge?: ReactNode;
  children: ReactNode;
};

export function AppShell({ activeSection, onSelectSection, title, headerBadge, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-8 border-b border-border bg-surface p-4 lg:w-64 lg:border-b-0 lg:border-r lg:p-6">
        <Brand />
        <SidebarNav active={activeSection} onSelect={onSelectSection} />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar title={title}>{headerBadge}</TopBar>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
