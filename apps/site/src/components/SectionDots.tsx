import { useEffect, useState } from "react";
import { HORIZONTAL_QUERY } from "../lib/motion";

const PANEL_IDS = ["acasa", "ce-gaseste", "run", "plan", "cum-merge", "preturi", "intrebari", "final"];

// The page is a run: sources, analysis, plan, steps. The rail numbers that sequence.
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
      <nav aria-label={label} className="fixed left-2.5 top-1/2 z-40 hidden -translate-y-1/2 horizontal:block">
        <ol className="flex flex-col gap-1">
          {PANEL_IDS.map((id, index) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-label={names[index]}
                aria-current={index === active ? "true" : undefined}
                title={names[index]}
                className="group relative flex h-5 items-center gap-1.5 no-underline"
              >
                <span
                  className={`font-mono text-[10px] leading-none tabular-nums transition-colors ${
                    index === active ? "text-fg" : "text-fg-muted/40 group-hover:text-fg-muted"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-px transition-all ${
                    index === active ? "w-3 bg-fg" : "w-1 bg-fg-muted/25 group-hover:bg-fg-muted/60"
                  }`}
                />
                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap border border-line bg-canvas px-2 py-1 font-mono text-[10px] text-fg opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {names[index]}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-40 hidden h-px origin-left bg-fg horizontal:block"
        style={{ transform: "scaleX(var(--track-progress, 0))" }}
      />
    </>
  );
}
