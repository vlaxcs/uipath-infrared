import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { STEP_META } from "~/runs/stepMeta";
import { RUN_STEPS } from "~/runs/stepProgress";
import type { RunStep } from "~/runs/types";

/* The run's starting configuration, then each step of the pipeline. */
export type DialogPage = "start" | RunStep;
export const DIALOG_PAGES: readonly DialogPage[] = ["start", ...RUN_STEPS];

type StepDialogProps = {
  step: DialogPage;
  startTitle: string;
  onSelect: (step: DialogPage) => void;
  onClose: () => void;
  happened: ReactNode;
  log: ReactNode;
};

type Tab = "happened" | "log";
const TABS: { id: Tab; label: string }[] = [
  { id: "happened", label: "What happened" },
  { id: "log", label: "Log" },
];

const FOCUSABLE =
  "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

/* One step at a time; < and > walk the pipeline without changing the run. */
export function StepDialog({
  step,
  startTitle,
  onSelect,
  onClose,
  happened,
  log,
}: StepDialogProps) {
  const [tab, setTab] = useState<Tab>("happened");
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const index = DIALOG_PAGES.indexOf(step);
  const previous = index > 0 ? DIALOG_PAGES[index - 1] : null;
  const next = index < DIALOG_PAGES.length - 1 ? DIALOG_PAGES[index + 1] : null;
  const title = (page: DialogPage) => (page === "start" ? startTitle : STEP_META[page].title);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    const typing =
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select");
    if (!typing && event.key === "ArrowLeft" && previous) {
      event.preventDefault();
      onSelect(previous);
      return;
    }
    if (!typing && event.key === "ArrowRight" && next) {
      event.preventDefault();
      onSelect(next);
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    const focusable = [
      ...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ];
    if (focusable.length === 0) return;
    const [start, end] = [focusable[0], focusable[focusable.length - 1]];
    if (event.shiftKey && document.activeElement === start) {
      event.preventDefault();
      end.focus();
    } else if (!event.shiftKey && document.activeElement === end) {
      event.preventDefault();
      start.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-result-title"
        className="flex h-full w-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-float"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <NavButton
                label={
                  previous
                    ? `Previous step: ${title(previous)}`
                    : "No previous step"
                }
                disabled={!previous}
                onClick={() => previous && onSelect(previous)}
              >
                ‹
              </NavButton>
              <span className="min-w-12 text-center text-caption text-fg-subtle">
                {index + 1} / {DIALOG_PAGES.length}
              </span>
              <NavButton
                label={
                  next ? `Next step: ${title(next)}` : "No next step"
                }
                disabled={!next}
                onClick={() => next && onSelect(next)}
              >
                ›
              </NavButton>
            </div>
            <h2 id="step-result-title" className="text-title font-semibold">
              {title(step)}
            </h2>
          </div>
          <button
            ref={close}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-control text-title text-fg-muted hover:bg-surface-muted"
          >
            ×
          </button>
        </div>
        <div
          role="tablist"
          aria-label="Step views"
          className="flex gap-1 border-b border-border px-4"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`step-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls="step-tab-panel"
              onClick={() => setTab(item.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-label ${tab === item.id ? "border-accent font-semibold text-fg" : "border-transparent text-fg-muted hover:text-fg"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id="step-tab-panel"
          aria-labelledby={`step-tab-${tab}`}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {tab === "happened" ? happened : log}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-control text-title text-fg hover:bg-surface-muted disabled:opacity-30"
    >
      {children}
    </button>
  );
}
