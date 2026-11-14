import { useEffect, useRef, useState } from "react";
import type { Frame } from "~/insights/geometry";

export type Numbers = Record<string, number>;

function reducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

// Glides every key from where it is now to the target; new keys start at the target.
export function useTween(target: Numbers, duration = 720): Numbers {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const key = JSON.stringify(target);

  useEffect(() => {
    const from = current.current;
    if (reducedMotion() || typeof requestAnimationFrame !== "function") {
      current.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = ease(t);
      const next: Numbers = {};
      for (const [name, to] of Object.entries(target)) {
        const origin = from[name] ?? to;
        next[name] = origin + (to - origin) * k;
      }
      current.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);

  return value;
}

export function useFrame(): Frame {
  const query = "(min-width: 56rem)";
  const read = () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : true);
  const [wide, setWide] = useState(read);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const change = () => setWide(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  return wide ? "wide" : "tall";
}
