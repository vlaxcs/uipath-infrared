import { useEffect, useRef, useState } from "react";
import wasmUrl from "@rive-app/canvas/rive.wasm?url";
import iconUrl from "~/assets/infrared-icon.svg";
import type { MascotAnimation } from "~/mascot/animations";
import riveUrl from "~/mascot/infrared.riv?url";

const ARTBOARD = "Infrared";

type MascotProps = {
  animation: MascotAnimation;
  className?: string;
  label?: string;
};

export function Mascot({ animation, className = "h-24 w-24", label }: MascotProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const instance = useRef<import("@rive-app/canvas").Rive | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    import("@rive-app/canvas")
      .then(({ Rive, RuntimeLoader, Layout, Fit }) => {
        if (cancelled || !canvas.current) return;
        RuntimeLoader.setWasmUrl(wasmUrl);
        instance.current = new Rive({
          src: riveUrl,
          canvas: canvas.current,
          artboard: ARTBOARD,
          animations: animation,
          autoplay: true,
          layout: new Layout({ fit: Fit.Contain }),
          onLoad: () => {
            if (cancelled) return;
            instance.current?.resizeDrawingSurfaceToCanvas();
            setPlaying(true);
          },
          onLoadError: () => setPlaying(false),
        });
      })
      .catch(() => setPlaying(false));
    return () => {
      cancelled = true;
      instance.current?.cleanup();
      instance.current = null;
    };
    // Loaded once; the effect below switches the animation without reloading the file.
  }, []);

  useEffect(() => {
    const rive = instance.current;
    if (!rive || !playing) return;
    rive.stop();
    rive.play(animation);
  }, [animation, playing]);

  return (
    <span
      className={`relative inline-block ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-mascot={animation}
    >
      <img src={iconUrl} alt="" className={`h-full w-full object-contain ${playing ? "invisible" : ""}`} />
      <canvas ref={canvas} className={`absolute inset-0 h-full w-full ${playing ? "" : "invisible"}`} />
    </span>
  );
}
