import { useEffect, useId, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose(): void;
  footer?: ReactNode;
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

export function Dialog({ open, title, description, onClose, footer, children, size = "md" }: DialogProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("input, textarea, select, button:not([data-dialog-close])");
    (first ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className={`flex max-h-[92vh] w-full ${widths[size]} flex-col rounded-t-card border border-line bg-surface shadow-float sm:rounded-card`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id={`${id}-title`} className="type-heading">
              {title}
            </h2>
            {description && (
              <p id={`${id}-description`} className="type-body mt-1 text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            data-dialog-close
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-item px-2 py-1 text-fg-muted hover:bg-sunken hover:text-fg"
          >
            ✕
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</footer>}
      </div>
    </div>
  );
}
