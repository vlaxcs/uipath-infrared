import { useId, type ReactNode } from "react";
import type { Severity } from "../content";

const WHITE = { fill: "#fff" };
const LINE = { fill: "none", stroke: "#fff", strokeWidth: 6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const GLYPHS: Record<string, ReactNode> = {
  CAMERA_STREAM_EXPOSED: (
    <>
      <rect x="-20" y="-11" width="27" height="22" rx="6" {...WHITE} />
      <path d="M9 -5 L20 -11 V11 L9 5 Z" {...WHITE} stroke="#fff" strokeWidth={3} strokeLinejoin="round" />
      <circle className="badge-rec" cx="-12" cy="-17" r="3.5" {...WHITE} />
    </>
  ),
  TELNET_OPEN: (
    <>
      <rect x="-20" y="-2" width="40" height="17" rx="6" {...WHITE} />
      <path d="M-12 -2 V-14 M12 -2 V-14" {...LINE} />
      <circle className="badge-antenna" cx="-12" cy="-17" r="4.5" {...WHITE} />
      <circle className="badge-antenna badge-antenna-late" cx="12" cy="-17" r="4.5" {...WHITE} />
    </>
  ),
  HTTP_ADMIN_CLEARTEXT: (
    <>
      <path className="badge-shackle" d="M-9 -3 V-9 A9 9 0 0 1 9 -9 V-3" {...LINE} />
      <rect x="-15" y="-3" width="30" height="21" rx="5" {...WHITE} />
    </>
  ),
  MQTT_EXPOSED: (
    <>
      <path className="badge-rays" d="M0 -27 V-31 M-17 -20 L-20 -23 M17 -20 L20 -23" {...LINE} strokeWidth={4} />
      <path d="M0 -20 A14 14 0 0 1 9 5 V9 H-9 V5 A14 14 0 0 1 0 -20 Z" {...WHITE} />
      <rect x="-7" y="12" width="14" height="6" rx="3" {...WHITE} />
    </>
  ),
  PRINTER_RAW_EXPOSED: (
    <>
      <rect x="-11" y="-19" width="22" height="10" rx="2" {...WHITE} />
      <rect className="badge-paper" x="-11" y="2" width="22" height="16" rx="2" {...WHITE} />
      <rect x="-20" y="-8" width="40" height="17" rx="6" {...WHITE} />
    </>
  ),
  UNKNOWN_DEVICE: (
    <g className="badge-question">
      <path d="M-7 -8 A8 8 0 1 1 3 0 Q0 2 0 6" {...LINE} />
      <circle cx="0" cy="15" r="3.6" {...WHITE} />
    </g>
  ),
};

const COLORS: Record<Severity, { main: string; shade: string; lip: string }> = {
  high: { main: "var(--color-badge-high)", shade: "var(--color-badge-high-shade)", lip: "var(--color-badge-high-lip)" },
  medium: { main: "var(--color-badge-medium)", shade: "var(--color-badge-medium-shade)", lip: "var(--color-badge-medium-lip)" },
  low: { main: "var(--color-badge-low)", shade: "var(--color-badge-low-shade)", lip: "var(--color-badge-low-lip)" },
};

export function FindArt({
  code,
  severity,
  index = 0,
  className = "size-20 rounded-well sm:size-24",
}: {
  code: string;
  severity: Severity;
  index?: number;
  className?: string;
}) {
  const gradientId = `badge${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const colors = COLORS[severity];
  return (
    <div aria-hidden="true" className={`grid flex-none place-items-center bg-surface ${className}`}>
      <svg
        viewBox="-50 -46 100 100"
        className="badge h-[78%] overflow-visible"
        data-code={code}
        data-severity={severity}
        style={{ ["--badge-delay" as string]: `${index * -0.45}s` }}
      >
        <ellipse className="badge-shadow" cx="0" cy="48" rx="30" ry="4.5" fill="rgb(26 28 27 / 0.12)" />
        <g className="badge-body">
          <defs>
            <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor={colors.main} />
              <stop offset="0.55" stopColor={colors.main} />
              <stop offset="1" stopColor={colors.shade} />
            </radialGradient>
          </defs>
          <circle cx="0" cy="6" r="38" fill={colors.lip} />
          <circle cx="0" cy="0" r="38" fill={`url(#${gradientId})`} />
          <ellipse className="badge-glint" cx="-17" cy="-22" rx="11" ry="5" fill="rgb(255 255 255 / 0.45)" transform="rotate(-32 -17 -22)" />
          <g transform="scale(1.15)">{GLYPHS[code] ?? GLYPHS.UNKNOWN_DEVICE}</g>
        </g>
      </svg>
    </div>
  );
}
