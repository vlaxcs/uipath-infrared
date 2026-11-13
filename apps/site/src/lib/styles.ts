type ButtonVariant = "accent" | "secondary";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  accent: "border-transparent bg-accent text-on-accent shadow-lip shadow-accent-lip hover:bg-accent-lip",
  secondary: "border-line bg-surface text-fg shadow-lip hover:border-fg-muted",
};

type ButtonSize = "regular" | "compact";

const BUTTON_SIZES: Record<ButtonSize, string> = {
  regular: "type-button min-h-13 px-7",
  compact: "type-tag h-10 px-5 font-bold",
};

export function buttonClass(variant: ButtonVariant, extra = "", size: ButtonSize = "regular") {
  return [
    "inline-flex items-center justify-center gap-2 rounded-full border-2 text-center no-underline",
    BUTTON_SIZES[size],
    "transition-[filter,translate,box-shadow] duration-150 active:translate-y-1 active:shadow-none",
    BUTTON_VARIANTS[variant],
    extra,
  ].join(" ");
}

export const PANEL =
  "relative flex min-h-svh snap-start flex-col justify-center px-4 py-24 sm:px-8 horizontal:h-full horizontal:min-h-0 horizontal:flex-none horizontal:px-[clamp(3rem,7vw,8rem)] horizontal:pt-[clamp(5.5rem,14svh,7.5rem)] horizontal:pb-[clamp(2rem,7svh,4.5rem)]";
