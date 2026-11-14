type ButtonVariant = "accent" | "secondary";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  accent: "border-accent bg-accent text-on-accent hover:bg-accent-lip focus-visible:outline-fg",
  secondary: "border-line bg-surface text-fg hover:border-fg-muted hover:bg-surface-raised",
};

type ButtonSize = "regular" | "compact";

const BUTTON_SIZES: Record<ButtonSize, string> = {
  regular: "type-button min-h-11 px-5",
  compact: "type-tag h-9 px-3.5",
};

export function buttonClass(variant: ButtonVariant, extra = "", size: ButtonSize = "regular") {
  return [
    "inline-flex items-center justify-center gap-2 rounded-[2px] border text-center no-underline",
    BUTTON_SIZES[size],
    "transition-[background-color,border-color,color] duration-150",
    BUTTON_VARIANTS[variant],
    extra,
  ].join(" ");
}

export const PANEL =
  "relative flex min-h-svh snap-start flex-col justify-center border-b border-line px-5 py-24 sm:px-8 horizontal:h-full horizontal:min-h-0 horizontal:flex-none horizontal:border-r horizontal:border-b-0 horizontal:px-[clamp(2.5rem,5vw,5.5rem)] horizontal:pt-[clamp(5rem,12svh,6.5rem)] horizontal:pb-[clamp(2rem,6svh,4rem)]";
