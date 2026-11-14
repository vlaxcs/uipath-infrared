import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "~/ui/Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent shadow-[0_2px_0_var(--accent-lip)] hover:brightness-110",
  secondary: "bg-surface text-fg border border-line-strong shadow-lip hover:bg-sunken",
  danger: "bg-danger text-on-accent shadow-[0_2px_0_var(--danger-lip)] hover:brightness-110",
  ghost: "bg-transparent text-fg-muted hover:text-fg hover:bg-sunken",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pending?: boolean;
}

export function Button({ variant = "secondary", pending = false, disabled, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`type-label inline-flex min-h-9 items-center justify-center gap-2 rounded-item px-3.5 py-1.5 transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
