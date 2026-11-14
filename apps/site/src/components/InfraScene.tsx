import type { CSSProperties } from "react";

type Point = [number, number, number];
type Tone = "steel" | "accent";
type Block = { x: number; y: number; z: number; w: number; d: number; h: number };
type Rack = Block & { slots: number; led?: "fixed" | "accent" };
type Traveller = { kind: "cube" | "window"; from: Point; to: Point; delay: number };

const UNIT = 26;
const COS = Math.cos(Math.PI / 6);
const ARC_LIFT = 90;

function project([x, y, z]: Point): [number, number] {
  return [(x - y) * COS * UNIT, ((x + y) / 2 - z) * UNIT];
}

function points(corners: Point[]): string {
  return corners.map((corner) => project(corner).map((value) => value.toFixed(1)).join(",")).join(" ");
}

const FACES: Record<Tone, { top: string; left: string; right: string }> = {
  steel: { top: "fill-line-strong", left: "fill-surface-raised", right: "fill-surface" },
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
            <circle cx={ledX} cy={ledY} r={1.8} className={led === "accent" && slot === 0 ? "fill-accent" : "fill-status-fixed"} />
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

const SITE_A: Point = [0, 0, 0];
const SITE_B: Point = [7, -7, 0];
const SLAB = 5;

const RACKS_A: Rack[] = [
  { x: 0.4, y: 0.4, z: 0, w: 1, d: 1, h: 3, slots: 5, led: "accent" },
  { x: 1.9, y: 0.4, z: 0, w: 1, d: 1, h: 2.2, slots: 3 },
  { x: 3.4, y: 0.4, z: 0, w: 1.1, d: 1.1, h: 3.4, slots: 6, led: "accent" },
  { x: 0.4, y: 2.1, z: 0, w: 1, d: 1, h: 1.6, slots: 2 },
  { x: 3.3, y: 2.4, z: 0, w: 1.2, d: 1.2, h: 1.2, slots: 1 },
];

const RACKS_B: Rack[] = [
  { x: 7.4, y: -6.6, z: 0, w: 1, d: 1, h: 1.8, slots: 3 },
  { x: 8.8, y: -6.6, z: 0, w: 1, d: 1, h: 1.8, slots: 3 },
  { x: 10.2, y: -6.6, z: 0, w: 1, d: 1, h: 1.8, slots: 3 },
  { x: 7.4, y: -5.1, z: 0, w: 1, d: 1, h: 1.2, slots: 2 },
];

const TRAVELLERS: Traveller[] = [
  { kind: "cube", from: [1.9, 3.1, 0], to: [9.1, -3.6, 0], delay: 0 },
  { kind: "window", from: [10.4, -3.2, 0.2], to: [1.6, 4.4, 0.2], delay: -4.5 },
  { kind: "cube", from: [0.6, 3.6, 0], to: [10.6, -4.9, 0], delay: -2.2 },
];

function TravellerShape({ traveller }: { traveller: Traveller }) {
  const [fromX, fromY] = project(traveller.from);
  const [toX, toY] = project(traveller.to);
  const style = {
    "--dx": `${(toX - fromX).toFixed(1)}px`,
    "--dy": `${(toY - fromY).toFixed(1)}px`,
    "--lift": `${ARC_LIFT}px`,
    animationDelay: `${traveller.delay}s`,
  } as CSSProperties;
  const [x, y, z] = traveller.from;
  return (
    <g className="infra-travel" style={style}>
      {traveller.kind === "cube" ? <Box x={x} y={y} z={z} w={0.9} d={0.9} h={0.9} tone="accent" /> : <Window x={x} y={y} z={z} />}
    </g>
  );
}

function Link({ from, to }: { from: Point; to: Point }) {
  const [fromX, fromY] = project(from);
  const [toX, toY] = project(to);
  const controlX = (fromX + toX) / 2;
  const controlY = (fromY + toY) / 2 - ARC_LIFT * 2;
  return (
    <path
      d={`M${fromX.toFixed(1)} ${fromY.toFixed(1)} Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${toX.toFixed(1)} ${toY.toFixed(1)}`}
      fill="none"
      strokeWidth={1.5}
      strokeDasharray="4 6"
      className="stroke-fg/25"
    />
  );
}

const byDepth = (first: Block, second: Block) => first.x + first.y - (second.x + second.y);

export function InfraScene({ label }: { label: string }) {
  return (
    <svg viewBox="-150 -215 600 370" role="img" aria-label={label} className="h-auto w-full overflow-visible">
      <Box x={SITE_A[0]} y={SITE_A[1]} z={-0.5} w={SLAB} d={SLAB} h={0.5} />
      <Box x={SITE_B[0]} y={SITE_B[1]} z={-0.5} w={SLAB} d={SLAB} h={0.5} />
      {[...RACKS_A].sort(byDepth).map((rack) => (
        <RackBox key={`a${rack.x}${rack.y}`} {...rack} />
      ))}
      {[...RACKS_B].sort(byDepth).map((rack) => (
        <RackBox key={`b${rack.x}${rack.y}`} {...rack} />
      ))}
      {TRAVELLERS.map((traveller) => (
        <Link key={`link${traveller.from.join()}`} from={traveller.from} to={traveller.to} />
      ))}
      {TRAVELLERS.map((traveller) => (
        <TravellerShape key={traveller.from.join()} traveller={traveller} />
      ))}
    </svg>
  );
}
