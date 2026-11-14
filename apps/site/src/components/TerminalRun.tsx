import { useEffect, useRef, useState } from "react";
import { PROMPT, TERMINAL_LINES, TERMINAL_TEXT } from "../data/run";
import { copyText } from "../lib/copy";
import { PlanLineRow } from "./PlanLines";

const PROMPT_LINE = TERMINAL_LINES[0];
const OUTPUT_LINES = TERMINAL_LINES.slice(1);

function staticTerminal() {
  if (typeof window === "undefined") return true;
  if (typeof IntersectionObserver === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function TerminalRun({
  label,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [staticState] = useState(staticTerminal);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(() => (staticState ? TERMINAL_LINES.length : 1));
  const [typed, setTyped] = useState(() => (staticState ? PROMPT.length : 0));
  const started = useRef(false);
  const timers = useRef<number[]>([]);
  const scrollArea = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLElement>(null);

  useEffect(() => {
    if (staticState || started.current) return;
    const element = figure.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();

        let char = 0;
        const typeCommand = () => {
          char += 1;
          setTyped(char);
          if (char < PROMPT.length) {
            timers.current.push(window.setTimeout(typeCommand, 17));
            return;
          }
          let next = 1;
          const stream = () => {
            setRevealed(next + 1);
            next += 1;
            if (next < TERMINAL_LINES.length) {
              const line = TERMINAL_LINES[next];
              const delay = line.kind === "blank" ? 70 : line.kind === "heading" ? 125 : 85;
              timers.current.push(window.setTimeout(stream, delay));
            }
          };
          timers.current.push(window.setTimeout(stream, 220));
        };
        typeCommand();
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    };
  }, [staticState]);

  useEffect(() => {
    if (!scrollArea.current) return;
    scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [revealed, typed]);

  async function copy() {
    const copied = await copyText(TERMINAL_TEXT);
    setCopied(copied);
    if (copied) window.setTimeout(() => setCopied(false), 1800);
  }

  const complete = revealed >= TERMINAL_LINES.length;
  const promptText = PROMPT_LINE.text;
  const visiblePrompt = staticState ? promptText : promptText.slice(0, typed);

  return (
    <figure
      ref={figure}
      aria-label={label}
      className="raised flex h-[clamp(30rem,74svh,44rem)] min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-3 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[11px] font-medium text-fg">{label}</span>
          <span className="font-mono text-[10px] text-fg-muted">read-only</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-[10px] text-fg-muted">run 7f3a2c</span>
          <span className="font-mono text-[10px] text-fg-muted">2026-11-14 02:41:07 UTC</span>
          <button
            type="button"
            onClick={copy}
            className="rounded-[1px] border border-line px-2.5 py-1 font-mono text-[10px] text-fg-muted transition-colors hover:border-fg-muted hover:text-fg focus-visible:outline-fg"
          >
            <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
          </button>
        </div>
      </figcaption>

      <div ref={scrollArea} className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <ol className="min-w-[44rem] font-mono" aria-busy={!complete}>
          <li className="flex items-baseline whitespace-pre px-2 py-[2px]">
            <span
              aria-hidden="true"
              className="w-7 flex-none select-none pr-3 text-right font-mono text-[10px] tabular-nums text-fg-muted/45"
            >
              01
            </span>
            <span className="min-w-0 flex-1 whitespace-pre font-mono text-[12px] leading-[1.65] tabular-nums text-fg">
              <span className="text-fg-muted">$</span>
              {visiblePrompt.slice(1)}
              {!staticState && <span className="terminal-caret ml-1" aria-hidden="true" />}
            </span>
          </li>
          {OUTPUT_LINES.slice(0, Math.max(0, revealed - 1)).map((line, index) => (
            <PlanLineRow key={line.id} line={line} lineNumber={index + 2} showNumber />
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
        <p className="font-mono text-[10px] text-fg-muted">
          {complete ? "plan ready for approval" : "streaming"}
        </p>
        <p className="font-mono text-[10px] text-fg-muted">4 steps / pull request</p>
      </div>
    </figure>
  );
}
