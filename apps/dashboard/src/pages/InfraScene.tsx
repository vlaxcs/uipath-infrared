import { useState } from "react";

type Point = [number, number, number];
type Tone = "steel" | "accent";
type Block = { x: number; y: number; z: number; w: number; d: number; h: number };
type Rack = Block & { slots: number; led?: "fixed" | "accent" };
type Traveller = { kind: "cube" | "window"; from: Point; to: Point; delay: number; duration: number };

const UNIT = 26;
const COS = Math.cos(Math.PI / 6);
const MAX_LIFT = 170;
const EASE = "0.42 0 0.58 1";
const DWELL_THERE_AND_BACK = { keyPoints: "0;0;1;1;0;0", keyTimes: "0;0.1;0.44;0.6;0.94;1", keySplines: Array(5).fill(EASE).join(";") };

function project([x, y, z]: Point): [number, number] {
  return [(x - y) * COS * UNIT, ((x + y) / 2 - z) * UNIT];
}

function points(corners: Point[]): string {
  return corners.map((corner) => project(corner).map((value) => value.toFixed(1)).join(",")).join(" ");
}

const FACES: Record<Tone, { top: string; left: string; right: string }> = {
  steel: { top: "fill-line-strong", left: "fill-surface-muted", right: "fill-surface" },
  accent: { top: "fill-accent-lip", left: "fill-accent", right: "fill-accent/70" },
};

const EDGE = "stroke-fg/15";

function Box({ x, y, z, w, d, h, tone = "steel" }: Block & { tone?: Tone }) {
  const faces = FACES[tone];
  return (
    <g strokeWidth={1} strokeLinejoin="round" className={EDGE}>
      <polygon className={faces.left} points={points([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])} />
      <polygon className={faces.right} points={points([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])} />
      <polygon className={faces.top} points={points([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])} />
    </g>
  );
}

function RackBox(rack: Rack) {
  const { x, y, z, w, d, h, slots, led = "fixed" } = rack;
  const front = y + d;
  const pitch = h / (slots + 1);
  return (
    <g>
      <Box {...rack} />
      {Array.from({ length: slots }, (_, slot) => {
        const level = z + pitch * (slot + 1);
        const [ledX, ledY] = project([x + w - 0.3, front, level + 0.07]);
        return (
          <g key={slot}>
            <polygon
              className="fill-canvas"
              points={points([[x + 0.15, front, level], [x + w - 0.5, front, level], [x + w - 0.5, front, level + 0.14], [x + 0.15, front, level + 0.14]])}
            />
            <circle cx={ledX} cy={ledY} r={1.8} className={led === "accent" && slot === 0 ? "fill-accent" : "fill-status-completed"} />
          </g>
        );
      })}
    </g>
  );
}

function Window({ x, y, z, w = 1.8, h = 1.3 }: { x: number; y: number; z: number; w?: number; h?: number }) {
  const bar = h * 0.22;
  return (
    <g strokeWidth={1} strokeLinejoin="round" className={EDGE}>
      <polygon className="fill-surface" points={points([[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]])} />
      <polygon className="fill-line" points={points([[x, y, z + h - bar], [x + w, y, z + h - bar], [x + w, y, z + h], [x, y, z + h]])} />
      {[0.2, 0.4, 0.6].map((offset) => {
        const [cx, cy] = project([x + offset, y, z + h - bar / 2]);
        return <circle key={offset} cx={cx} cy={cy} r={1.8} stroke="none" className={offset === 0.2 ? "fill-accent" : "fill-fg-muted"} />;
      })}
      {[0.55, 0.32].map((level, row) => (
        <polygon
          key={level}
          stroke="none"
          className="fill-line"
          points={points([[x + 0.2, y, z + h * level], [x + w * (row ? 0.55 : 0.8), y, z + h * level], [x + w * (row ? 0.55 : 0.8), y, z + h * level + 0.1], [x + 0.2, y, z + h * level + 0.1]])}
        />
      ))}
    </g>
  );
}

const SITES: Point[] = [
  [0, 0, 0],
  [7, -7, 0],
  [14, -14, 0],
];
const SLAB = 5;

const RACKS: Rack[] = [
  { x: 0.4, y: 0.4, z: 0, w: 1, d: 1, h: 3, slots: 5, led: "accent" },
  { x: 1.9, y: 0.4, z: 0, w: 1, d: 1, h: 2.2, slots: 3 },
  { x: 3.4, y: 0.4, z: 0, w: 1.1, d: 1.1, h: 3.4, slots: 6, led: "accent" },
  { x: 0.4, y: 2.1, z: 0, w: 1, d: 1, h: 1.6, slots: 2 },
  { x: 3.3, y: 2.4, z: 0, w: 1.2, d: 1.2, h: 1.2, slots: 1 },
  { x: 7.4, y: -6.6, z: 0, w: 1, d: 1, h: 1.8, slots: 3 },
  { x: 8.8, y: -6.6, z: 0, w: 1, d: 1, h: 1.8, slots: 3 },
  { x: 10.2, y: -6.6, z: 0, w: 1, d: 1, h: 1.8, slots: 3 },
  { x: 7.4, y: -5.1, z: 0, w: 1, d: 1, h: 1.2, slots: 2 },
  { x: 14.4, y: -13.6, z: 0, w: 1, d: 1, h: 2.6, slots: 4, led: "accent" },
  { x: 15.9, y: -13.6, z: 0, w: 1, d: 1, h: 3.2, slots: 5 },
  { x: 17.4, y: -13.6, z: 0, w: 1.2, d: 1.2, h: 2, slots: 3 },
  { x: 14.4, y: -12.1, z: 0, w: 1, d: 1, h: 1.4, slots: 2 },
];

const TRAVELLERS: Traveller[] = [
  { kind: "cube", from: [1.9, 3.1, 0], to: [9.1, -3.6, 0], delay: 0, duration: 6.4 },
  { kind: "window", from: [7.2, -2.1, 0.2], to: [0.2, 4.9, 0.2], delay: -2.8, duration: 7.6 },
  { kind: "cube", from: [0.6, 3.6, 0], to: [17.6, -10.9, 0], delay: -1.2, duration: 8.8 },
  { kind: "cube", from: [10.6, -4.9, 0], to: [15, -10.6, 0], delay: -4, duration: 5.8 },
  { kind: "window", from: [16.2, -9.1, 0.2], to: [2.6, 5, 0.2], delay: -6.2, duration: 9.2 },
  { kind: "cube", from: [17.9, -11.9, 0], to: [10.9, -3.3, 0], delay: -2, duration: 6.8 },
  { kind: "cube", from: [3, 4, 0], to: [11.4, -5.4, 0], delay: -5.2, duration: 6.2 },
];

function arc(traveller: Traveller) {
  const [fromX, fromY] = project(traveller.from);
  const [toX, toY] = project(traveller.to);
  const lift = Math.min(MAX_LIFT, 50 + Math.abs(toX - fromX) * 0.18);
  return { fromX, fromY, toX, toY, controlX: (fromX + toX) / 2, controlY: (fromY + toY) / 2 - lift * 2 };
}

function curve(startX: number, startY: number, controlX: number, controlY: number, endX: number, endY: number): string {
  return [`M${startX.toFixed(1)} ${startY.toFixed(1)}`, `Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`].join(" ");
}

function TravellerShape({ traveller, moving }: { traveller: Traveller; moving: boolean }) {
  const { fromX, fromY, toX, toY, controlX, controlY } = arc(traveller);
  const [x, y, z] = traveller.from;
  return (
    <g>
      {traveller.kind === "cube" ? <Box x={x} y={y} z={z} w={0.9} d={0.9} h={0.9} tone="accent" /> : <Window x={x} y={y} z={z} />}
      {moving && (
        <animateMotion
          path={curve(0, 0, controlX - fromX, controlY - fromY, toX - fromX, toY - fromY)}
          dur={`${traveller.duration}s`}
          begin={`${traveller.delay}s`}
          repeatCount="indefinite"
          calcMode="spline"
          {...DWELL_THERE_AND_BACK}
        />
      )}
    </g>
  );
}

function Link({ traveller, moving }: { traveller: Traveller; moving: boolean }) {
  const { fromX, fromY, toX, toY, controlX, controlY } = arc(traveller);
  return (
    <path data-link="" d={curve(fromX, fromY, controlX, controlY, toX, toY)} fill="none" strokeWidth={1.5} strokeDasharray="4 6" className="stroke-fg/25">
      {moving && <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.8s" repeatCount="indefinite" />}
    </path>
  );
}

const byDepth = (first: Block, second: Block) => first.x + first.y - (second.x + second.y);

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function InfraScene({ className }: { className?: string }) {
  const [moving] = useState(() => !prefersReducedMotion());
  return (
    <svg data-scene="infrastructure" viewBox="-140 -145 910 305" aria-hidden="true" focusable="false" className={className}>
      {SITES.map(([x, y]) => (
        <Box key={`slab${x}`} x={x} y={y} z={-0.5} w={SLAB} d={SLAB} h={0.5} />
      ))}
      {[...RACKS].sort(byDepth).map((rack) => (
        <RackBox key={`${rack.x}${rack.y}`} {...rack} />
      ))}
      {TRAVELLERS.map((traveller) => (
        <Link key={`link${traveller.from.join()}`} traveller={traveller} moving={moving} />
      ))}
      {TRAVELLERS.map((traveller) => (
        <TravellerShape key={traveller.from.join()} traveller={traveller} moving={moving} />
      ))}
    </svg>
  );
}
