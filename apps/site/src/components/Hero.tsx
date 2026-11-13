import { useEffect, useRef } from "react";
import { animate, createAnimatable, createScope, utils } from "animejs";
import type { Content } from "../content";
import { buttonClass, PANEL } from "../lib/styles";

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
    <section ref={root} id="acasa" aria-labelledby="hero-titlu" className={`${PANEL} overflow-hidden pt-28 horizontal:w-screen`}>
      <div className="mx-auto grid w-full max-w-content items-center gap-14 lg:grid-cols-2 lg:gap-20 horizontal:gap-[clamp(4rem,8vw,9rem)]">
        <ChatScreenshot text={text} />
        <div className="max-lg:order-first">
          <p className="type-eyebrow mb-6 text-accent">{text.hero.eyebrow}</p>
          <h1 id="hero-titlu" className="type-h1 max-w-[16ch] text-fg">
            {text.hero.title}
          </h1>
          <p className="type-lead mt-6 max-w-[36ch] text-fg-muted">{text.hero.lead}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#cum-merge" className={buttonClass("accent")}>
              {text.hero.primary}
            </a>
            <a href="#ce-gaseste" className={buttonClass("secondary")}>
              {text.hero.secondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatScreenshot({ text }: { text: Content }) {
  return (
    <div className="justify-self-center perspective-distant lg:justify-self-end">
      <div className="rotate-x-20 -rotate-z-10 transform-3d">
        <div data-intro className="transform-3d">
          <div data-tilt className="transform-3d">
            <img
              data-float
              src={text.hero.chatImage}
              alt={text.hero.chatAlt}
              width={835}
              height={1704}
              fetchPriority="high"
              // The picture has its own black bezel: outer corner 99px = screen corner 77px + bezel 22px, out of 835px.
              // Clipping with the same 99/835 of the width keeps that rule at every size.
              className="w-(--phone) rounded-[calc(var(--phone)*0.1186)] shadow-float [--phone:min(20rem,72vw)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
