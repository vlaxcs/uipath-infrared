import type { Content, Language } from "../content";
import { buttonClass } from "../lib/styles";
import { Logo } from "./Logo";

export function Brand({ href = "#acasa" }: { href?: string }) {
  return (
    <a href={href} className="flex items-center gap-2.5 rounded-full no-underline">
      <Logo className="size-8 sm:size-9" />
      <span className="type-h4 font-extrabold text-fg">Infrared</span>
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
    <div role="group" aria-label={label} className="relative grid h-10 grid-cols-2 rounded-full border-2 border-line bg-canvas p-1">
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-full bg-fg transition-transform duration-300 ease-[cubic-bezier(0.3,0.9,0.3,1.1)]"
        style={{ transform: `translateX(${LANGUAGES.indexOf(language) * 100}%)` }}
      />
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={language === code}
          onClick={() => onLanguage(code)}
          className={`type-tag relative z-10 h-full min-w-10 cursor-pointer rounded-full px-2.5 font-bold transition-colors duration-300 ${
            language === code ? "text-canvas" : "text-fg-muted hover:text-fg"
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Every control in the bar has the same height (2.5rem) and is centred in the same 5rem row, so each sits the same distance from the top.
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
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="px-4 sm:px-8 horizontal:px-[clamp(3rem,7vw,8rem)]">
        <div className="mx-auto flex h-20 max-w-content items-center justify-between gap-2 sm:gap-4">
          <Brand />
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitch label={text.languageLabel} language={language} onLanguage={onLanguage} />
            {showCta && (
              <a href="#cum-merge" className={buttonClass("accent", "shadow-none! max-sm:hidden", "compact")}>
                {text.nav.cta}
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
