import type { Content, Language } from "../content";
import { buttonClass } from "../lib/styles";
import { Logo } from "./Logo";

export function Brand({ href = "#acasa" }: { href?: string }) {
  return (
    <a href={href} className="flex items-center gap-2.5 no-underline">
      <Logo className="size-8" />
      <span className="text-[1.0625rem] font-medium tracking-[-0.02em] text-fg">Infrared</span>
    </a>
  );
}

const LANGUAGES = ["ro", "en"] as const;

export function LanguageSwitch({
  label,
  language,
  onLanguage,
}: {
  label: string;
  language: Language;
  onLanguage: (language: Language) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      {LANGUAGES.map((code, index) => (
        <span key={code} className="flex items-center gap-1.5">
          {index > 0 && (
            <span aria-hidden="true" className="text-fg-muted/50">
              /
            </span>
          )}
          <button
            type="button"
            aria-pressed={language === code}
            onClick={() => onLanguage(code)}
            className={`type-tag cursor-pointer bg-transparent px-1 py-1 font-medium uppercase tracking-wide ${
              language === code ? "text-fg underline underline-offset-4" : "text-fg-muted hover:text-fg"
            }`}
          >
            {code.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}

const LINKS = [
  { id: "ce-gaseste", label: 1 },
  { id: "run", label: 2 },
  { id: "plan", label: 3 },
  { id: "cum-merge", label: 4 },
  { id: "preturi", label: 5 },
  { id: "intrebari", label: 6 },
];

export function Nav({
  text,
  language,
  onLanguage,
  showCta,
}: {
  text: Content;
  language: Language;
  onLanguage: (language: Language) => void;
  showCta: boolean;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-canvas">
      <div className="px-5 sm:px-8 horizontal:px-[clamp(2.5rem,5vw,5.5rem)]">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4">
          <Brand />
          {showCta && (
            <nav aria-label={text.nav.progress} className="hidden min-w-0 items-center gap-6 xl:flex">
              {LINKS.map((link) => (
                <a key={link.id} href={`#${link.id}`} className="type-tag whitespace-nowrap text-fg-muted no-underline hover:text-fg">
                  {text.nav.sections[link.label]}
                </a>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-3 sm:gap-5">
            <LanguageSwitch label={text.languageLabel} language={language} onLanguage={onLanguage} />
            {showCta && (
              <a href="#preturi" className={buttonClass("accent", "max-sm:hidden", "compact")}>
                {text.nav.cta}
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
