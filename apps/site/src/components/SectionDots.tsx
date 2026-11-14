// Only on the sideways page: a thin progress line. Section names live in the nav.
export function SectionDots() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 bottom-0 z-40 hidden h-px origin-left bg-fg horizontal:block"
      style={{ transform: "scaleX(var(--track-progress, 0))" }}
    />
  );
}
