import { useEffect, useState } from "react";

import type { Language } from "../content";
import { AnimatedMascot, type MascotState } from "../components/AnimatedMascot";
import { startReveal } from "../lib/motion";
import { Band, Header } from "../pitch/Pitch";
import { pitch2Copy } from "./copy";

const MASCOTS: MascotState[][] = [
  ["mood_warn", "look"],
  ["mood_ok", "talk"],
  ["mood_ok", "wiggle"],
];

function Shout({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\p{Lu}{3,})/u).map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="text-accent">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function Pitch2() {
  const [language, setLanguage] = useState<Language>("en");
  const t = pitch2Copy[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.title;
  }, [language, t]);

  useEffect(startReveal, [language]);

  return (
    <>
      <a
        href="#continut"
        className="type-button absolute -top-20 left-4 z-100 rounded-2xl bg-status-warn px-4 py-2.5 text-on-accent no-underline focus:top-3"
      >
        {t.skipLink}
      </a>
      <Header t={t} language={language} onLanguage={setLanguage} />
      <main id="continut" tabIndex={-1} className="text-fg outline-none">
        {t.sections.map((section, index) => (
          <Band key={section.id} id={section.id} label={section.label} title={<Shout text={section.title} />} mascot={MASCOTS[index]} tint={index % 2 === 1}>
            {section.tagline && (
              <p className="type-h2 mt-4 text-fg">
                <Shout text={section.tagline} />
              </p>
            )}
            {section.shots && (
              <div className="mt-10 flex flex-col items-center justify-center gap-8 lg:flex-row lg:items-start">
                {section.shots.map((shot) => (
                  <figure key={shot.src} className="m-0 flex flex-col items-center gap-3">
                    <img
                      src={shot.src}
                      alt={shot.alt}
                      width={shot.width}
                      height={shot.height}
                      loading="lazy"
                      className={shot.width > shot.height ? "w-full rounded-card border-2 border-line shadow-float lg:h-80 lg:w-auto" : "w-[min(14rem,60vw)] lg:h-80 lg:w-auto"}
                    />
                    <figcaption className="type-h4 text-accent">{shot.who}</figcaption>
                  </figure>
                ))}
              </div>
            )}
            {section.points.length > 0 && (
              <ul className="mt-10 grid gap-6 md:grid-cols-2">
                {section.points.map((point) => (
                  <li key={point.who} className="flex flex-col gap-2 rounded-card border-2 border-line bg-surface p-6 shadow-lip">
                    <h3 className="type-h4 text-accent">{point.who}</h3>
                    <p className="type-lead text-fg">{point.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Band>
        ))}
        <section aria-labelledby="final-titlu" className="bg-canvas px-4 py-18 text-center sm:px-8 lg:py-28">
          <div className="mx-auto flex w-full max-w-content flex-col items-center gap-8">
            <AnimatedMascot className="size-48 lg:size-64" />
            <h2 id="final-titlu" className="type-h1 max-w-[16ch] text-fg" style={{ fontSize: "clamp(2.75rem, 6.5vw, 5.5rem)" }}>
              {t.closing}
            </h2>
          </div>
        </section>
      </main>
    </>
  );
}
