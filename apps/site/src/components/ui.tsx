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

export function Heading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="type-h2 max-w-[24ch] text-fg">
      {children}
    </h2>
  );
}
