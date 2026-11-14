import { useEffect, useRef } from "react";
import { animate, createAnimatable, createScope, utils } from "animejs";
import type { Content } from "../content";
import { buttonClass, PANEL } from "../lib/styles";
import { InfraScene } from "./InfraScene";

export function Hero({ text }: { text: Content }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const scope = createScope({ root, mediaQueries: { reduceMotion: "(prefers-reduced-motion: reduce)" } }).add((self) => {
      if (self?.matches.reduceMotion) {
        utils.set("[data-intro]", { opacity: 1 });
        return;
      }

      animate("[data-intro]", {
        opacity: [0, 1],
        translateY: [120, 0],
        rotateX: [55, 0],
        scale: [0.85, 1],
        duration: 1400,
        ease: "outElastic(1, .7)",
      });

      animate("[data-float]", {
        translateY: [-6, 6],
        rotateZ: [-1, 1],
        duration: 3200,
        ease: "inOutSine",
        loop: true,
        alternate: true,
      });

      const tilt = createAnimatable("[data-tilt]", { rotateX: 700, rotateY: 700, ease: "out(3)" });
      const section = root.current;
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" || !section) return;
        const box = section.getBoundingClientRect();
        tilt.rotateY(((event.clientX - box.left) / box.width - 0.5) * 16);
        tilt.rotateX(-((event.clientY - box.top) / box.height - 0.5) * 12);
      };
      const onPointerLeave = () => {
        tilt.rotateY(0);
        tilt.rotateX(0);
      };
      section?.addEventListener("pointermove", onPointerMove);
      section?.addEventListener("pointerleave", onPointerLeave);
      return () => {
        section?.removeEventListener("pointermove", onPointerMove);
        section?.removeEventListener("pointerleave", onPointerLeave);
      };
    });
    return () => scope.revert();
  }, []);

  return (
    <section ref={root} id="acasa" aria-labelledby="hero-titlu" className={`${PANEL} overflow-hidden bg-canvas pt-28 horizontal:w-screen`}>
      <div className="mx-auto flex w-full max-w-content flex-col items-center text-center horizontal:min-h-0 horizontal:flex-1">
        <h1 id="hero-titlu" className="type-h1 text-fg">
          <span className="block sm:whitespace-nowrap">{text.hero.title[0]}</span>{" "}
          <span className="block sm:whitespace-nowrap">{text.hero.title[1]}</span>
        </h1>
        <p className="type-lead mt-4 max-w-[48ch] text-fg-muted">{text.hero.lead}</p>
        <div className="relative mt-10 w-full perspective-distant horizontal:mt-6 horizontal:min-h-0 horizontal:flex-1">
          <div data-intro className="transform-3d horizontal:h-full">
            <div data-tilt className="transform-3d horizontal:h-full">
              <div data-float className="horizontal:h-full">
                <InfraScene label={text.hero.scene.label} />
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3 sm:absolute sm:inset-x-0 sm:bottom-[6%] sm:z-10 sm:mt-0">
            <a href="#ce-gaseste" className={buttonClass("secondary", "max-sm:w-full", "large")}>
              {text.hero.secondary}
            </a>
            <a href="#preturi" className={buttonClass("accent", "max-sm:w-full", "large")}>
              {text.hero.primary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
