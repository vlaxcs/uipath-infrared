import { useEffect, useRef, type ReactNode } from "react";
import { cancelScroll, HORIZONTAL_QUERY, isScrolling, scrollToY } from "../lib/motion";
import { rememberScroll, takeRememberedScroll } from "../lib/scrollMemory";
import { nearestRest, restStops, stepStop } from "../lib/snap";
import { createWheelIntent } from "../lib/wheelIntent";

const SNAP_DELAY = 100;
const SNAP_JUMP = 48;
const SNAP_MIN_TRAVEL = 10;
const SWIPE_MIN_DISTANCE = 24;
const SWIPE_MIN_VELOCITY = 0.35;

let scrollToRestore = takeRememberedScroll();

export function HorizontalTrack({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const sticky = stickyRef.current;
    const track = trackRef.current;
    if (!outer || !sticky || !track || typeof window.matchMedia !== "function" || typeof ResizeObserver === "undefined") return;
    const media = window.matchMedia(HORIZONTAL_QUERY);
    const root = document.documentElement;
    const wheelIntent = createWheelIntent();
    let distance = 0;
    let trackStart = 0;
    let frame = 0;
    let touch: { x: number; y: number; at: number; from: number; dragging: boolean } | null = null;
    let velocity = 0;
    let focusFromKeyboard = false;
    let snapTimer = 0;
    let pointerHeld = false;
    let lastY = window.scrollY;
    let travel = 0;
    let snapping = false;
    let targetX: number | null = null;

    function start() {
      const stickyTop = parseFloat(getComputedStyle(sticky!).top) || 0;
      return outer!.getBoundingClientRect().top + window.scrollY - stickyTop;
    }

    function currentX() {
      return Math.min(distance, Math.max(0, window.scrollY - trackStart));
    }

    function render() {
      frame = 0;
      if (!media.matches) return;
      const progress = distance > 0 ? currentX() / distance : 0;
      track!.style.transform = `translate3d(${-currentX()}px, 0, 0)`;
      root.style.setProperty("--track-progress", progress.toFixed(4));
    }

    function measure() {
      if (!media.matches) {
        outer!.style.height = "";
        track!.style.transform = "";
        root.style.removeProperty("--track-progress");
        return;
      }
      trackStart = start();
      distance = Math.max(0, track!.scrollWidth - sticky!.clientWidth);
      outer!.style.height = `${distance + sticky!.clientHeight}px`;
      render();
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(render);
    }

    function panels() {
      const trackLeft = track!.getBoundingClientRect().left;
      return Array.from(track!.querySelectorAll("section, footer"), (panel) => {
        const box = panel.getBoundingClientRect();
        return { start: box.left - trackLeft, end: box.right - trackLeft };
      });
    }

    function goTo(x: number) {
      targetX = x;
      travel = 0;
      snapping = true;
      scrollToY(trackStart + x, false);
    }

    // One section forward or back. A push that comes while a move is still running goes on
    // from where that move was heading, so quick pushes never get lost or skip a section.
    function step(direction: number, from = targetX ?? currentX()) {
      goTo(stepStop(restStops(sticky!.clientWidth, distance, panels()), from, direction));
    }

    // Nothing was pushing the page any more (a scrollbar drag, say): settle on a section.
    function snap() {
      snapTimer = 0;
      if (!media.matches || touch || pointerHeld || isScrolling()) return;
      snapping = false;
      targetX = null;
      const direction = Math.abs(travel) >= SNAP_MIN_TRAVEL ? Math.sign(travel) : 0;
      const x = currentX();
      const rest = nearestRest(x, direction, sticky!.clientWidth, distance, panels());
      travel = 0;
      const gap = Math.abs(rest - x);
      if (gap >= 1) {
        snapping = true;
        scrollToY(trackStart + rest, gap < SNAP_JUMP);
      }
    }

    function snapSoon() {
      clearTimeout(snapTimer);
      snapTimer = window.setTimeout(snap, SNAP_DELAY);
    }

    function onScroll() {
      schedule();
      const y = window.scrollY;
      if (!snapping) travel += y - lastY;
      lastY = y;
      if (media.matches) snapSoon();
    }

    function onWheel(event: WheelEvent) {
      if (!media.matches || event.ctrlKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? sticky!.clientWidth : 1;
      const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit;
      const direction = wheelIntent(delta, event.timeStamp);
      if (direction) step(direction);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") focusFromKeyboard = true;
      if (!media.matches || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest("input, textarea, select, [contenteditable]")) return;
      let direction = 0;
      let edge: number | null = null;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          direction = 1;
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          direction = -1;
          break;
        case " ":
          if (target.closest("button, a, summary")) return;
          direction = event.shiftKey ? -1 : 1;
          break;
        case "Home":
          edge = 0;
          break;
        case "End":
          edge = distance;
          break;
        default:
          return;
      }
      event.preventDefault();
      if (edge !== null) goTo(edge);
      else step(direction);
    }

    function onPointerDown() {
      focusFromKeyboard = false;
      pointerHeld = true;
      cancelScroll();
    }

    // A drag on the scrollbar may never send a pointerup, so a mouse move with no button held also counts.
    function onPointerUp(event?: Event) {
      if (!pointerHeld) return;
      pointerHeld = false;
      if ((event as PointerEvent | undefined)?.pointerType === "mouse") travel = 0;
      if (media.matches) snapSoon();
    }

    function onPointerMove(event: PointerEvent) {
      if (pointerHeld && event.buttons === 0) onPointerUp(event);
    }

    function scrollToElement(element: Element, immediate: boolean) {
      const panel = element.closest("section, footer") ?? element;
      const x = Math.min(distance, Math.max(0, panel.getBoundingClientRect().left - track!.getBoundingClientRect().left));
      targetX = x;
      travel = 0;
      snapping = true;
      scrollToY(trackStart + x, immediate);
    }

    function onClick(event: MouseEvent) {
      if (!media.matches || event.defaultPrevented) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      const id = link?.hash.slice(1);
      const target = id ? document.getElementById(decodeURIComponent(id)) : null;
      if (!target || !track!.contains(target)) return;
      event.preventDefault();
      history.pushState(null, "", `#${id}`);
      scrollToElement(target, false);
    }

    function onFocusIn(event: FocusEvent) {
      if (!media.matches || !focusFromKeyboard) return;
      const target = event.target as Element;
      if (!track!.contains(target)) return;
      const panel = target.closest("section, footer");
      if (!panel || panel === target) return;
      const box = target.getBoundingClientRect();
      if (box.left >= 0 && box.right <= sticky!.clientWidth) return;
      scrollToElement(target, true);
    }

    function onHide() {
      if (document.visibilityState === "hidden") rememberScroll(window.scrollY);
    }

    function onPageHide() {
      rememberScroll(window.scrollY);
    }

    function onTouchStart(event: TouchEvent) {
      cancelScroll();
      velocity = 0;
      touch = { x: event.touches[0].clientX, y: event.touches[0].clientY, at: event.timeStamp, from: currentX(), dragging: false };
    }

    // A sideways drag moves the page with the finger; letting go goes one section the way it was dragged.
    function onTouchMove(event: TouchEvent) {
      if (!media.matches || !touch) return;
      const { clientX: x, clientY: y } = event.touches[0];
      const dx = touch.x - x;
      if (Math.abs(dx) > Math.abs(touch.y - y)) {
        window.scrollBy(0, dx);
        velocity = dx / Math.max(1, event.timeStamp - touch.at);
        touch.dragging = true;
      } else {
        velocity = 0;
      }
      touch = { ...touch, x, y, at: event.timeStamp };
    }

    function onTouchEnd() {
      const ended = touch;
      touch = null;
      if (!media.matches || !ended) return;
      if (!ended.dragging) {
        snapSoon();
        return;
      }
      const moved = currentX() - ended.from;
      const flicked = Math.abs(velocity) >= SWIPE_MIN_VELOCITY;
      const pushed = flicked || Math.abs(moved) >= SWIPE_MIN_DISTANCE;
      step(pushed ? Math.sign(flicked ? velocity : moved) : 0, ended.from);
    }

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(track);
    resizeObserver.observe(sticky);
    media.addEventListener("change", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onPointerUp);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    const remembered = scrollToRestore;
    const forgetRestore = setTimeout(() => (scrollToRestore = null), 0);
    if (remembered !== null) history.scrollRestoration = "manual";
    measure();
    if (remembered !== null) scrollToY(remembered, true);
    document.fonts?.ready.then(measure);

    return () => {
      clearTimeout(forgetRestore);
      clearTimeout(snapTimer);
      cancelAnimationFrame(frame);
      cancelScroll();
      resizeObserver.disconnect();
      media.removeEventListener("change", measure);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onPointerUp);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      outer.style.height = "";
      track.style.transform = "";
      root.style.removeProperty("--track-progress");
    };
  }, []);

  return (
    <div ref={outerRef}>
      <div ref={stickyRef} className="horizontal:sticky horizontal:top-0 horizontal:h-svh horizontal:overflow-clip">
        <div ref={trackRef} className="horizontal:flex horizontal:h-full horizontal:w-max horizontal:will-change-transform">
          {children}
        </div>
      </div>
    </div>
  );
}
