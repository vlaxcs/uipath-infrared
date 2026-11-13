import { SECTIONS, type SectionId } from "~/navigation/sections";

type SidebarNavProps = {
  active: SectionId;
  onSelect: (id: SectionId) => void;
};

export function SidebarNav({ active, onSelect }: SidebarNavProps) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {SECTIONS.map((section) => {
        const isActive = section.id === active;
        return (
          <button
            key={section.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(section.id)}
            className={
              isActive
                ? "flex items-center gap-3 rounded-control bg-surface-muted px-3 py-2 text-left text-label font-medium text-fg"
                : "flex items-center gap-3 rounded-control px-3 py-2 text-left text-label font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
            }
          >
            <span
              className={isActive ? "h-1.5 w-1.5 rounded-pill bg-accent" : "h-1.5 w-1.5 rounded-pill bg-transparent"}
              aria-hidden="true"
            />
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
