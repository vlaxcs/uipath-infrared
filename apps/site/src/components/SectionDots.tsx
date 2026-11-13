import { useEffect, useState } from "react";
import { HORIZONTAL_QUERY } from "../lib/motion";

const PANEL_IDS = ["acasa", "ce-gaseste", "cum-merge", "intrebari", "final"];

// Only on the sideways page: where you are, a way to jump, and a thin progress line.
export function SectionDots({ label, names }: { label: string; names: string[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(HORIZONTAL_QUERY);
    let frame = 0;

    function update() {
      frame = 0;
      if (!media.matches) return;
      let current = 0;
      PANEL_IDS.forEach((id, index) => {
        const panel = document.getElementById(id);
        if (panel && panel.getBoundingClientRect().left <= window.innerWidth / 2) current = index;
      });
      setActive(current);
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <>
      <nav aria-label={label} className="fixed top-1/2 right-2 z-40 hidden -translate-y-1/2 horizontal:block">
        <ul className="flex flex-col">
          {PANEL_IDS.map((id, index) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-label={names[index]}
                aria-current={index === active ? "true" : undefined}
                title={names[index]}
                className="group grid size-8 place-items-center rounded-full"
              >
                <span
                  className={`block rounded-full border-2 transition-all duration-200 ${
                    index === active
                      ? "h-6 w-3 border-accent bg-accent"
                      : "size-3 border-fg-muted bg-canvas group-hover:bg-fg-muted"
                  }`}
                />
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-40 hidden h-1 origin-left bg-accent horizontal:block"
        style={{ transform: "scaleX(var(--track-progress, 0))" }}
      />
    </>
  );
}
