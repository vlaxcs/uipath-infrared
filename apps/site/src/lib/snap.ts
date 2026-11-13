export type Panel = { start: number; end: number };

const LOOKAHEAD = 0.5;
// w-screen is 100vw, which includes the scrollbar, so a panel can be a few pixels wider than the
// visible width without being a wide panel.
const SLACK = 40;

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

// Where the track should come to rest. x is the track's current offset, direction is
// the way the person was scrolling (-1, 0 or 1). A panel that fits the screen has one
// rest position, its left edge. A panel wider than the screen has a whole range, so
// it can be read in the middle. Looking half a screen ahead in the scroll
// direction means any real push moves on to the next panel, like turning a page.
export function nearestRest(x: number, direction: number, viewport: number, distance: number, panels: Panel[]): number {
  const probe = x + direction * viewport * LOOKAHEAD;
  let best = clamp(x, 0, distance);
  let bestGap = Infinity;
  for (const panel of panels) {
    const low = clamp(panel.start, 0, distance);
    const overflow = panel.end - panel.start - viewport;
    const high = clamp(overflow > SLACK ? panel.end - viewport : panel.start, low, distance);
    const gap = Math.abs(probe - clamp(probe, low, high));
    if (direction > 0 ? gap <= bestGap : gap < bestGap) {
      bestGap = gap;
      best = clamp(x, low, high);
    }
  }
  return best;
}

// The positions the track can rest at: the left edge of every panel, plus the right-aligned
// position of a panel wider than the screen.
export function restStops(viewport: number, distance: number, panels: Panel[]): number[] {
  const all: number[] = [];
  for (const panel of panels) {
    all.push(clamp(panel.start, 0, distance));
    if (panel.end - panel.start - viewport > SLACK) all.push(clamp(panel.end - viewport, 0, distance));
  }
  all.sort((a, b) => a - b);
  return all.filter((stop, index) => index === 0 || stop - all[index - 1] >= 8);
}

// One stop forward (1) or back (-1) from the stop nearest to from. 0 means the nearest stop.
export function stepStop(stops: number[], from: number, direction: number): number {
  let nearest = 0;
  for (let index = 1; index < stops.length; index++) {
    if (Math.abs(stops[index] - from) < Math.abs(stops[nearest] - from)) nearest = index;
  }
  return stops[clamp(nearest + direction, 0, stops.length - 1)];
}
