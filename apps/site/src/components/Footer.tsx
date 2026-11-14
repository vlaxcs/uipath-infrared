import { useState } from "react";
import type { Content } from "../content";
import { copyText } from "../lib/copy";
import { Logo } from "./Logo";

const PRODUCT_LINKS = [
  { id: "ce-gaseste", label: 1 },
  { id: "run", label: 2 },
  { id: "plan", label: 3 },
  { id: "cum-merge", label: 4 },
  { id: "preturi", label: 5 },
  { id: "intrebari", label: 6 },
];

export function Footer({ text, tokensHref }: { text: Content; tokensHref: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    const copied = await copyText(text.footer.prompt);
    setCopied(copied);
    if (copied) window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <footer
      id="final"
      className="relative flex min-h-svh snap-start flex-col justify-center border-r border-line px-5 py-24 sm:px-8 horizontal:h-full horizontal:min-h-0 horizontal:w-screen horizontal:flex-none horizontal:px-[clamp(2.5rem,5vw,5.5rem)]"
    >
      <div className="mx-auto w-full max-w-content">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3">
              <Logo className="size-8" />
              <p className="font-mono text-[11px] font-medium tracking-[0.02em] text-fg">Infrared</p>
            </div>
            <h2 className="type-h2 mt-8 max-w-[20ch] text-fg">{text.footer.title}</h2>
            <div className="raised mt-8 max-w-[44rem]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2">
                <p className="font-mono text-[10px] text-fg">end of run</p>
                <p className="font-mono text-[10px] text-fg-muted">read-only / run 7f3a2c</p>
              </div>
              <div className="px-4 py-6">
                <p className="font-mono text-[clamp(1.8rem,3.6vw,3rem)] leading-none tracking-[-0.05em] text-fg">
                  <span className="text-fg-muted">$</span> {text.footer.prompt}
                </p>
                <p className="type-tag mt-4 max-w-[40ch] text-fg-muted">{text.footer.promptNote}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                <button
                  type="button"
                  onClick={copyCommand}
                  className="rounded-[1px] border border-line px-3 py-1.5 font-mono text-[10px] text-fg-muted transition-colors hover:border-fg-muted hover:text-fg focus-visible:outline-fg"
                >
                  <span aria-live="polite">{copied ? text.footer.copied : text.footer.copy}</span>
                </button>
                <a
                  href="#preturi"
                  className="border border-accent bg-accent px-3 py-1.5 font-mono text-[11px] font-medium text-on-accent no-underline transition-colors hover:bg-accent-lip"
                >
                  {text.nav.cta}
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 border-t border-line pt-6 lg:col-span-4 lg:border-t-0 lg:border-l lg:border-line lg:pt-0 lg:pl-10">
            <div>
              <p className="font-mono text-[11px] text-fg">{text.footer.product}</p>
              <ul className="mt-4 grid gap-2.5">
                {PRODUCT_LINKS.map((link) => (
                  <li key={link.id}>
                    <a href={`#${link.id}`} className="font-mono text-[10px] text-fg-muted no-underline hover:text-fg">
                      {text.nav.sections[link.label]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[11px] text-fg">{text.footer.resources}</p>
              <ul className="mt-4 grid gap-2.5">
                <li>
                  <a href={tokensHref} className="font-mono text-[10px] text-fg-muted no-underline hover:text-fg">
                    {text.footer.tokensLink}
                  </a>
                </li>
                <li>
                  <a href="#acasa" className="font-mono text-[10px] text-fg-muted no-underline hover:text-fg">
                    {text.footer.back}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-baseline justify-between gap-3 border-t border-line-strong pt-4">
          <p className="font-mono text-[10px] text-fg">Infrared</p>
          <p className="font-mono text-[10px] text-fg-muted">{text.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
