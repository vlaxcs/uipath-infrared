import { HORIZONTAL_QUERY, scrollToY } from "./motion";
import { nearestRest } from "./snap";

const SNAP_DELAY = 90;
const MIN_TRAVEL = 10;
const JUMP = 0.75;
const PANELS = "section[id], footer[id]";

// The vertical page (narrow window, or reduced motion) with a mouse or trackpad: the same
// "settle on a section" rule as the sideways track. Touch screens snap natively in CSS.
export function startVerticalSnap() {
  if (typeof window.matchMedia !== "function") return () => {};
  const horizontal = window.matchMedia(HORIZONTAL_QUERY);
  const fine = window.matchMedia("(pointer: fine)");
  let timer = 0;
  let lastY = window.scrollY;
  let travel = 0;
  let snapping = false;
  let held = false;

  const active = () => !horizontal.matches && fine.matches;

  function snap() {
    timer = 0;
    if (!active() || held) return;
    snapping = false;
    const panels = Array.from(document.querySelectorAll(PANELS), (panel) => {
      const box = panel.getBoundingClientRect();
      return { start: box.top + window.scrollY, end: box.bottom + window.scrollY };
    });
    if (panels.length === 0) return;
    const distance = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const direction = Math.abs(travel) >= MIN_TRAVEL ? Math.sign(travel) : 0;
    travel = 0;
    const rest = nearestRest(window.scrollY, direction, window.innerHeight, distance, panels);
    if (Math.abs(rest - window.scrollY) >= 1) {
      snapping = true;
      scrollToY(rest, false);
    }
  }

  function snapSoon() {
    clearTimeout(timer);
    timer = window.setTimeout(snap, SNAP_DELAY);
  }

  function onScroll() {
    const y = window.scrollY;
    const delta = y - lastY;
    // An anchor jump covers more than a viewport; it should land on its target, not
    // read as a push toward the next section.
    if (!snapping && Math.abs(delta) < window.innerHeight * JUMP) travel += delta;
    lastY = y;
    if (active()) snapSoon();
  }

  function onPointerDown() {
    held = true;
  }

  function onPointerUp() {
    if (!held) return;
    held = false;
    travel = 0;
    if (active()) snapSoon();
  }

  function onPointerMove(event: PointerEvent) {
    if (held && event.buttons === 0) onPointerUp();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", onPointerUp, true);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("blur", onPointerUp);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerUp, true);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("blur", onPointerUp);
  };
}
