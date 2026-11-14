import { useEffect, useRef, useState } from "react";
import riveFile from "../../rive/infrared.riv?url";
import wasmUrl from "@rive-app/canvas/rive.wasm?url";
import { MascotMark } from "./MascotMark";

export type InfraredAnimation = "hood" | "float" | "chomp" | "reorganise" | "grow" | "scan" | "sunset";

const IS_BUILDING: Record<InfraredAnimation, boolean> = {
  hood: false,
  float: false,
  chomp: false,
  reorganise: true,
  grow: true,
  scan: true,
  sunset: true,
};

/**
 * Plays one animation from the Infrared Rive file. The animation waits until it
 * is in view, and the static mark is shown while the file loads or when motion
 * is reduced.
 */
export function InfraredScene({ animation, className }: { animation: InfraredAnimation; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (!host.current || !canvas.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let instance: import("@rive-app/canvas").Rive | null = null;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    import("@rive-app/canvas")
      .then(({ Layout, Rive, RuntimeLoader, Fit }) => {
        if (cancelled || !canvas.current) return;
        RuntimeLoader.setWasmUrl(wasmUrl);
        instance = new Rive({
          src: riveFile,
          canvas: canvas.current,
          artboard: "Infrared",
          animations: [animation],
          autoplay: false,
          layout: new Layout({ fit: Fit.Contain }),
          onLoad: () => {
            if (cancelled || !instance) return;
            instance.resizeDrawingSurfaceToCanvas();
            instance.drawFrame();
            setPlaying(true);
            if (reduced || typeof IntersectionObserver === "undefined") {
              if (!reduced) instance.play();
              return;
            }
            observer = new IntersectionObserver(
              ([entry]) => {
                if (!instance) return;
                if (entry.isIntersecting) instance.play();
                else instance.pause();
              },
              { threshold: 0.35 },
            );
            if (host.current) observer.observe(host.current);
          },
        });
      })
      .catch(() => {
        // Keep the static mark if the runtime cannot load.
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      instance?.cleanup();
    };
  }, [animation]);

  return (
    <div
      ref={host}
      data-animation={animation}
      aria-hidden="true"
      className={`relative isolate aspect-[4/3] overflow-hidden ${className ?? ""}`}
    >
      <div className={`absolute inset-0 ${playing ? "invisible" : ""}`}>
        {IS_BUILDING[animation] ? (
          <img
            src="/mascot/animations/08-new-building.svg"
            alt=""
            width={320}
            height={288}
            className="size-full object-contain"
          />
        ) : (
          <MascotMark className="size-full" />
        )}
      </div>
      <canvas ref={canvas} className={`absolute inset-0 size-full ${playing ? "" : "invisible"}`} />
    </div>
  );
}
