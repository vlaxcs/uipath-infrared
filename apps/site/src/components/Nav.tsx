import type { Content, Language } from "../content";
import { buttonClass } from "../lib/styles";
import { AnimatedMascot } from "./AnimatedMascot";

export function Brand({ byDigi, href = "#acasa" }: { byDigi: string; href?: string }) {
  return (
    <a href={href} className="flex items-center gap-3 rounded-full no-underline sm:gap-4">
      <AnimatedMascot className="size-11 sm:size-14" />
      <span className="flex flex-col leading-none">
        <span className="type-h3 font-extrabold text-fg">Netpotu</span>
        <span className="type-tag text-fg-muted">{byDigi}</span>
      </span>
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
    <div role="group" aria-label={label} className="relative grid h-14 grid-cols-2 sm:h-16 rounded-full border-2 border-line bg-canvas p-1.5">
      <span
        aria-hidden="true"
        className="absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/2)] rounded-full bg-fg transition-transform duration-300 ease-[cubic-bezier(0.3,0.9,0.3,1.1)]"
        style={{ transform: `translateX(${LANGUAGES.indexOf(language) * 100}%)` }}
      />
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={language === code}
          onClick={() => onLanguage(code)}
          className={`type-label relative z-10 h-full min-w-12 cursor-pointer rounded-full px-3 transition-colors duration-300 ${
            language === code ? "text-canvas" : "text-fg-muted hover:text-fg"
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Every item in the bar has the same height (3.5rem, 4rem from sm up) and is centred in the same 5rem row, so each sits the same distance from the top.
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
          <div className="flex h-14 items-center rounded-full border-2 border-line bg-canvas pr-5 pl-2.5 sm:h-16 sm:pr-8 sm:pl-3">
            <Brand byDigi={text.byDigi} />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitch label={text.languageLabel} language={language} onLanguage={onLanguage} />
            {showCta && (
              <a href="#cum-merge" className={buttonClass("accent", "h-14 px-6 shadow-none! max-sm:hidden sm:h-16 sm:px-7")}>
                {text.nav.cta}
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
