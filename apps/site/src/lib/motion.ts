export const HORIZONTAL_QUERY = "(min-width: 64rem) and (prefers-reduced-motion: no-preference)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

let frame = 0;

export function matches(query: string) {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

export function isScrolling() {
  return frame !== 0;
}

export function cancelScroll() {
  cancelAnimationFrame(frame);
  frame = 0;
}

// A short ease-out, so a snap starts moving the moment it is asked to and lands quickly.
export function scrollToY(top: number, immediate: boolean) {
  cancelScroll();
  const from = window.scrollY;
  const delta = top - from;
  if (immediate || Math.abs(delta) < 1 || matches(REDUCED_MOTION_QUERY)) {
    window.scrollTo(0, top);
    return;
  }
  const duration = Math.min(900, 480 + Math.abs(delta) * 0.12);
  const startedAt = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    window.scrollTo(0, from + delta * (1 - Math.pow(1 - progress, 3)));
    frame = progress < 1 ? requestAnimationFrame(step) : 0;
  };
  frame = requestAnimationFrame(step);
}

export function startReveal() {
  const targets = document.querySelectorAll("[data-reveal]");
  if (typeof IntersectionObserver === "undefined" || matches(REDUCED_MOTION_QUERY)) {
    for (const target of targets) target.setAttribute("data-shown", "");
    return () => {};
  }
  document.documentElement.classList.add("js");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-shown", "");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px -6% -6% 0px" },
  );
  for (const target of targets) observer.observe(target);
  return () => {
    observer.disconnect();
    document.documentElement.classList.remove("js");
  };
}
