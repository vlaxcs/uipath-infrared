import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "~/ui/Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:brightness-110",
  secondary: "bg-surface text-fg border border-line-strong hover:bg-sunken",
  danger: "bg-danger text-on-accent hover:brightness-110",
  ghost: "bg-transparent text-fg-muted hover:text-fg hover:bg-sunken",
};

const sizes = {
  md: "type-label min-h-9 px-3.5 py-1.5",
  sm: "type-small min-h-7 px-2.5 py-1 font-semibold",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof sizes;
  pending?: boolean;
}

export function Button({ variant = "secondary", size = "md", pending = false, disabled, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${sizes[size]} inline-flex items-center justify-center gap-2 rounded-item transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
