import { useEffect, useState } from "react";
import { content, type Language } from "./content.ts";
import { Footer } from "./components/Footer.tsx";
import { Hero } from "./components/Hero.tsx";
import { HorizontalTrack } from "./components/HorizontalTrack.tsx";
import { Nav } from "./components/Nav.tsx";
import { SectionDots } from "./components/SectionDots.tsx";
import { Faq, Finds, HowItWorks } from "./components/Sections.tsx";
import { startReveal } from "./lib/motion.ts";
import { startVerticalSnap } from "./lib/verticalSnap.ts";
import TokensPage from "./TokensPage.tsx";

const TOKENS_HASH = "#/tokens";

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export default function App() {
  const [language, setLanguage] = useState<Language>("ro");
  const hash = useHash();
  const text = content[language];
  const onTokensPage = hash === TOKENS_HASH;

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = onTokensPage ? `Netpotu · ${text.tokens.title}` : `Netpotu, ${text.byDigi}`;
  }, [language, onTokensPage, text]);

  useEffect(startVerticalSnap, []);
  useEffect(startReveal, [onTokensPage, language]);

  return (
    <>
      <a
        href="#continut"
        className="type-button absolute -top-20 left-4 z-100 rounded-2xl bg-status-warn px-4 py-2.5 text-on-accent no-underline focus:top-3"
      >
        {text.skipLink}
      </a>
      <Nav text={text} language={language} onLanguage={setLanguage} showCta={!onTokensPage} />
      {onTokensPage ? (
        <main id="continut" tabIndex={-1} className="outline-none">
          <TokensPage text={text} />
          <p className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
            <a href="#acasa" className="text-accent underline underline-offset-4">
              {text.footer.productLink}
            </a>
          </p>
        </main>
      ) : (
        <HorizontalTrack>
          <main id="continut" tabIndex={-1} className="outline-none horizontal:flex horizontal:h-full">
            <Hero text={text} />
            <Finds text={text} />
            <HowItWorks text={text} />
            <Faq text={text} />
          </main>
          <Footer text={text} tokensHref={TOKENS_HASH} />
        </HorizontalTrack>
      )}
      {!onTokensPage && <SectionDots label={text.nav.progress} names={text.nav.sections} />}
    </>
  );
}
