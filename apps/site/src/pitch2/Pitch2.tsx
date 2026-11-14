import { useEffect, useState } from "react";

import type { Language } from "../content";
import { InfraScene } from "../components/InfraScene";
import { InfraredScene, type InfraredAnimation } from "../components/InfraredScene";
import { startReveal } from "../lib/motion";
import { buttonClass } from "../lib/styles";
import { Band, Header } from "../pitch/Pitch";
import { pitch2Copy } from "./copy";

const VISUALS: [InfraredAnimation, InfraredAnimation, InfraredAnimation] = ["reorganise", "grow", "scan"];
const TITLE_WIDTHS = ["max-w-[28ch]", "max-w-[28ch]", "max-w-[24ch]"] as const;

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
        <section className="bg-canvas px-4 pb-10 pt-14 sm:px-8 lg:pb-14 lg:pt-20">
          <div className="mx-auto grid w-full max-w-content items-center gap-8 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="type-label mb-4 text-accent">{t.byDigi}</p>
              <h1 className="type-h1 max-w-[18ch] text-fg">
                <Shout text={t.tagline} />
              </h1>
              <p className="type-lead mt-5 max-w-[46ch] text-fg-muted">{t.heroLead}</p>
              <a href="/" className={buttonClass("accent", "mt-6")}>
                {t.cta}
              </a>
            </div>
            <InfraredScene animation="scan" className="hidden w-56 sm:block lg:w-96" />
          </div>
        </section>

        {t.sections.map((section, index) => (
          <Band
            key={section.id}
            id={section.id}
            label={section.label}
            title={<Shout text={section.title} />}
            titleClassName={TITLE_WIDTHS[index] ?? "max-w-[24ch]"}
            tint={index % 2 === 1}
          >
            <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
              <p className="type-lead max-w-[44ch] text-fg-muted">
                <Shout text={section.tagline ?? ""} />
              </p>
              <InfraredScene
                animation={VISUALS[index] ?? "float"}
                className="mx-auto w-full max-w-[24rem] lg:mx-0 lg:max-w-none"
              />
            </div>
            <ul className={`mt-10 grid gap-4 ${section.points.length === 4 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
              {section.points.map((point) => (
                <li key={point.who} className="flex flex-col gap-2 rounded-card border-2 border-line bg-surface p-5">
                  <h3 className="type-h4 text-accent">{point.who}</h3>
                  <p className="type-body text-fg">{point.text}</p>
                </li>
              ))}
            </ul>
          </Band>
        ))}

        <section aria-labelledby="final-titlu" className="border-t-2 border-line bg-canvas px-4 py-18 text-center sm:px-8 lg:py-28">
          <div className="mx-auto flex w-full max-w-content flex-col items-center gap-8">
            <div className="aspect-[910/305] w-full max-w-[56rem] overflow-hidden lg:max-w-[64rem]">
              <InfraScene label={t.sceneLabel} />
            </div>
            <h2
              id="final-titlu"
              className="type-h1 max-w-[20ch] text-fg"
              style={{ fontSize: "clamp(2.75rem, 6.5vw, 5.5rem)" }}
            >
              <Shout text={t.closing} />
            </h2>
            <a href="/" className={buttonClass("accent")}>
              {t.cta}
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
