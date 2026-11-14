import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}

export function Field({ label, hint, error, className = "", ...rest }: FieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="type-label">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
        className={`type-body min-h-10 rounded-item border bg-surface px-3 py-2 text-fg placeholder:text-fg-muted/70 ${error ? "border-danger" : "border-line-strong"} ${className}`}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="type-small text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="type-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
