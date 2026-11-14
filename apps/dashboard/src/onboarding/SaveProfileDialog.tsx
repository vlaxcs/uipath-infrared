import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type SaveChoice = { saving: boolean; onSave: () => void; onSkip: () => void; onBack: () => void };

export function SaveProfileDialog({ choice }: { choice: SaveChoice }) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !choice.saving) {
      event.preventDefault();
      choice.onBack();
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    const buttons = [...dialog.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
    if (buttons.length === 0) return;
    const [start, end] = [buttons[0], buttons[buttons.length - 1]];
    if (event.shiftKey && document.activeElement === start) {
      event.preventDefault();
      end.focus();
    } else if (!event.shiftKey && document.activeElement === end) {
      event.preventDefault();
      start.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-sm" onKeyDown={onKeyDown}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        className="flex w-full max-w-md flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-float"
      >
        <h2 id={`${id}-title`} className="text-title font-semibold text-fg">
          Save the on-prem details to your profile?
        </h2>
        <p id={`${id}-body`} className="text-label text-fg-muted">
          You changed them for this run. Saving makes them the default for every new analysis.
        </p>
        <div className="flex flex-col gap-2">
          <button
            ref={first}
            type="button"
            onClick={choice.onSave}
            disabled={choice.saving}
            aria-busy={choice.saving}
            className="rounded-control bg-accent px-4 py-2 text-label font-medium text-on-accent disabled:opacity-50"
          >
            {choice.saving ? "Saving" : "Save to profile and start"}
          </button>
          <button
            type="button"
            onClick={choice.onSkip}
            disabled={choice.saving}
            className="rounded-control border border-border-strong bg-surface px-4 py-2 text-label font-medium text-fg disabled:opacity-50"
          >
            Start without saving
          </button>
          <button
            type="button"
            onClick={choice.onBack}
            disabled={choice.saving}
            className="rounded-control px-4 py-2 text-label font-medium text-fg-muted disabled:opacity-50"
          >
            Back to the form
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
