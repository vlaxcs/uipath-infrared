export type ColorToken = { name: string; value: string };

export type ColorPair = {
  text: string;
  background: string;
  large?: boolean;
};

export const colorPairs: ColorPair[] = [
  { text: "fg", background: "canvas" },
  { text: "fg", background: "canvas-tint" },
  { text: "fg", background: "surface-raised" },
  { text: "fg-muted", background: "canvas" },
  { text: "fg-muted", background: "surface" },
  { text: "accent", background: "canvas", large: true },
  { text: "on-accent", background: "accent" },
  { text: "paper", background: "canvas" },
  { text: "status-fixed", background: "canvas" },
  { text: "status-warn", background: "canvas" },
  { text: "status-danger", background: "canvas", large: true },
  { text: "canvas", background: "fg" },
];

export function parseColorTokens(css: string): ColorToken[] {
  const tokens: ColorToken[] = [];
  const pattern = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
  for (const match of css.matchAll(pattern)) {
    tokens.push({ name: match[1], value: match[2].toLowerCase() });
  }
  return tokens;
}

function channelToLinear(channel: number): number {
  const scaled = channel / 255;
  if (scaled <= 0.03928) {
    return scaled / 12.92;
  }
  return Math.pow((scaled + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const red = channelToLinear(parseInt(hex.slice(1, 3), 16));
  const green = channelToLinear(parseInt(hex.slice(3, 5), 16));
  const blue = channelToLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

export function requiredRatio(pair: ColorPair): number {
  return pair.large ? 3 : 4.5;
}

export function themeBlock(tokens: ColorToken[], originalCss: string): string {
  let updated = originalCss;
  for (const token of tokens) {
    const pattern = new RegExp(`(--color-${token.name}:\\s*)#[0-9a-fA-F]{6}`);
    updated = updated.replace(pattern, `$1${token.value}`);
  }
  return updated;
}
