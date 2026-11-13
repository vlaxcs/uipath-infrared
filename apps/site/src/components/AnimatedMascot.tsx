import { useEffect, useRef, useState } from "react";
import riveFile from "../../rive/netpot.riv?url";
import wasmUrl from "@rive-app/canvas/rive.wasm?url";

const STILL = "/netpot-mascot.webp";
// The "Netpot" state machine in this file plays the Rive watermark, so only plain animations run.
export type MascotState = "mood_ok" | "mood_warn" | "mood_danger" | "idle" | "look" | "tilt" | "wiggle" | "rest" | "talk";

const ANIMATIONS: MascotState[] = ["mood_ok", "idle"];

export function AnimatedMascot({ className, animations = ANIMATIONS }: { className?: string; animations?: MascotState[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const animationList = animations.join(",");

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!canvas.current) return;

    let instance: import("@rive-app/canvas").Rive | null = null;
    let cancelled = false;
    import("@rive-app/canvas").then(({ Rive, RuntimeLoader, Layout, Fit }) => {
      if (cancelled || !canvas.current) return;
      RuntimeLoader.setWasmUrl(wasmUrl);
      instance = new Rive({
        src: riveFile,
        canvas: canvas.current,
        artboard: "Netpot",
        animations: animationList.split(","),
        autoplay: true,
        layout: new Layout({ fit: Fit.Contain }),
        onLoad: () => {
          instance?.resizeDrawingSurfaceToCanvas();
          setPlaying(true);
        },
      });
    });
    return () => {
      cancelled = true;
      instance?.cleanup();
    };
  }, [animationList]);

  return (
    <span className={`relative inline-block ${className ?? ""}`} aria-hidden="true">
      <img src={STILL} alt="" width={312} height={320} className={`size-full object-contain ${playing ? "invisible" : ""}`} />
      <canvas ref={canvas} className={`absolute inset-0 size-full ${playing ? "" : "invisible"}`} />
    </span>
  );
}
