import type { ReactNode } from "react";
import { PANEL } from "../lib/styles";

export function Section({
  id,
  titleId,
  width = "horizontal:w-screen",
  inner = "",
  children,
}: {
  id: string;
  titleId: string;
  width?: string;
  inner?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={titleId} className={`${PANEL} ${width} bg-canvas`}>
      <div className={`mx-auto w-full max-w-content ${inner}`}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children, center = false }: { children: string; center?: boolean }) {
  return (
    <p data-reveal className={`type-eyebrow mb-4 flex items-center gap-3 text-accent data-shown:animate-appear ${center ? "justify-center" : ""}`}>
      {children}
    </p>
  );
}

export function Heading({ id, center = false, children }: { id: string; center?: boolean; children: string }) {
  return (
    <h2 id={id} data-reveal className={`type-h2 max-w-[22ch] text-fg data-shown:animate-unveil ${center ? "mx-auto text-center" : ""}`}>
      {children}
    </h2>
  );
}
