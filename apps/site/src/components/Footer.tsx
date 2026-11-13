import type { Content } from "../content";
import { AnimatedMascot } from "./AnimatedMascot";

export function Footer({ text, tokensHref }: { text: Content; tokensHref: string }) {
  return (
    <footer id="final" className="relative flex min-h-svh snap-start flex-col items-center justify-center gap-6 bg-canvas px-4 py-24 text-center sm:gap-8 sm:px-8 horizontal:h-full horizontal:min-h-0 horizontal:w-screen horizontal:flex-none">
      <AnimatedMascot className="size-36" />
      <div className="flex flex-col items-center gap-2">
        <p className="type-h3 text-fg">Netpotu</p>
        <p className="type-tag text-fg-muted">{text.byDigi}</p>
      </div>
      <h2 className="type-h1 max-w-[18ch] text-fg">{text.footer.title}</h2>
      <p className="type-lead max-w-[44ch] text-fg-muted">{text.footer.lead}</p>
      <p className="type-label inline-flex items-center gap-3 rounded-full border-2 border-accent px-5 py-3 text-fg">
        <span aria-hidden="true" className="text-accent">
          ✓
        </span>
        {text.how.promise}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6 horizontal:absolute horizontal:bottom-8 horizontal:mt-0">
        <a href="#acasa" className="type-tag text-fg-muted underline underline-offset-4 hover:text-fg">
          {text.footer.back}
        </a>
        <a href={tokensHref} className="type-tag text-fg-muted underline underline-offset-4 hover:text-fg">
          {text.footer.tokensLink}
        </a>
      </div>
    </footer>
  );
}
