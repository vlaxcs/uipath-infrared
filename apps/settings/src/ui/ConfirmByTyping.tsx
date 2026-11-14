import { useState, type ReactNode } from "react";
import { Button } from "~/ui/Button";
import { Dialog } from "~/ui/Dialog";
import { Field } from "~/ui/Field";
import { Notice } from "~/ui/Notice";

export interface ConfirmByTypingProps {
  open: boolean;
  title: ReactNode;
  expected: string;
  confirmLabel: string;
  onConfirm(): void;
  onClose(): void;
  pending?: boolean;
  error?: string | null;
  children?: ReactNode;
}

export function ConfirmByTyping({ open, title, expected, confirmLabel, onConfirm, onClose, pending, error, children }: ConfirmByTypingProps) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === expected;

  function close() {
    setTyped("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      title={title}
      onClose={close}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!matches} pending={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        <Field
          label={
            <>
              Type <code className="type-code rounded bg-sunken px-1">{expected}</code> to confirm
            </>
          }
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
}
