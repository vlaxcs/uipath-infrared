// Turns a stream of wheel events into "one push" decisions. A mouse notch, a trackpad swipe and
// the long inertia tail after a swipe each give at most one push, so the page moves one section
// per gesture instead of many.
const MIN_DELTA = 6;
const GAP = 140;
const REARM = 350;
const NOTCH_REARM = 250;

export function createWheelIntent() {
  let lastAt = -Infinity;
  let lastAbs = 0;
  let lastSign = 0;
  let triggeredAt = -Infinity;
  let handled = false;

  // delta in pixels (positive = forward), at in milliseconds. Returns -1, 0 or 1.
  return function intent(delta: number, at: number): number {
    const sign = Math.sign(delta);
    if (sign === 0) return 0;
    const abs = Math.abs(delta);
    const gap = at - lastAt;
    const sinceTrigger = at - triggeredAt;
    const notch = abs >= 50 && abs === lastAbs;
    const fresh =
      gap > GAP ||
      sign !== lastSign ||
      (sinceTrigger > REARM && abs > lastAbs * 1.5 + 8) ||
      (notch && sinceTrigger > NOTCH_REARM);
    lastAt = at;
    lastAbs = abs;
    lastSign = sign;
    if (fresh) handled = false;
    if (handled || abs < MIN_DELTA) return 0;
    handled = true;
    triggeredAt = at;
    return sign;
  };
}
