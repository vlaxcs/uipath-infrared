import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Language } from "../content";
import { AnimatedMascot, type MascotState } from "../components/AnimatedMascot";
import { Brand, LanguageSwitch } from "../components/Nav";
import { startReveal } from "../lib/motion";
import { buttonClass } from "../lib/styles";
import { isTodo, pitchCopy, type PitchCopy, type Slot, type Todo } from "./copy";

const PRODUCT_PAGE = "/";
const CARD = "flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-6 shadow-lip";

function revealDelay(index: number) {
  return { animationDelay: `${index * 120}ms` };
}

function Placeholder({ slot, label }: { slot: Todo; label: string }) {
  return (
    <span data-todo className="type-label inline-block rounded-item border-2 border-dashed border-status-warn bg-surface px-3 py-1 text-status-warn">
      [{label}: {slot.todo}]
    </span>
  );
}

function Fill({ slot, label }: { slot: Slot; label: string }) {
  return isTodo(slot) ? <Placeholder slot={slot} label={label} /> : <>{slot}</>;
}

export function Band({
  id,
  title,
  label,
  tint = false,
  mascot,
  titleClassName = "max-w-[24ch]",
  children,
}: {
  id: string;
  title: ReactNode;
  label: string;
  tint?: boolean;
  mascot?: MascotState[];
  titleClassName?: string;
  children: ReactNode;
}) {
  const titleId = `${id}-titlu`;
  return (
    <section id={id} aria-labelledby={titleId} className={`px-4 py-18 sm:px-8 lg:py-24 ${tint ? "bg-canvas-tint" : "bg-canvas"}`}>
      <div className="mx-auto w-full max-w-content">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="type-eyebrow mb-4 text-accent">{label}</p>
            <h2 id={titleId} data-reveal className={`type-h2 ${titleClassName} text-fg data-shown:animate-unveil`}>
              {title}
            </h2>
          </div>
          {mascot && <AnimatedMascot animations={mascot} className="hidden size-28 shrink-0 sm:inline-block lg:size-36" />}
        </div>
        {children}
      </div>
    </section>
  );
}

function LawPicker({ laws, sourceLabel }: { laws: PitchCopy["duty"]["laws"]; sourceLabel: string }) {
  const [chosen, setChosen] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const law = laws[chosen];

  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + laws.length) % laws.length;
    setChosen(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div role="tablist" aria-orientation="vertical" className="grid gap-4">
        {laws.map((item, index) => {
          const selected = index === chosen;
          return (
            <button
              key={item.short}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`lege-${index}`}
              aria-selected={selected}
              aria-controls="lege-panou"
              tabIndex={selected ? 0 : -1}
              onClick={() => setChosen(index)}
              onKeyDown={(event) => onKey(event, index)}
              className={`flex flex-col gap-1 rounded-well bg-accent px-5 py-4 text-left text-on-accent transition outline-offset-4 focus-visible:outline-3 focus-visible:outline-focus ${
                selected ? "shadow-float ring-4 ring-accent/30" : "opacity-70 hover:opacity-100"
              }`}
            >
              <span className="type-h4">{item.short}</span>
              <span className="type-tag">{item.summary}</span>
            </button>
          );
        })}
      </div>
      <div id="lege-panou" role="tabpanel" aria-labelledby={`lege-${chosen}`} aria-live="polite" className={`${CARD} lg:sticky lg:top-28 lg:self-start`}>
        <h3 className="type-h4 text-fg">{law.name}</h3>
        <p className="type-body text-fg">{law.says}</p>
        <span className="type-tag mt-auto pt-2 text-fg-muted">
          {sourceLabel}: {law.source}
        </span>
      </div>
    </div>
  );
}

function SideList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={CARD}>
      <h3 className="type-h3 text-fg">{title}</h3>
      <CheckList items={items} />
    </div>
  );
}

function FigureCard({ value, label, source, sourceLabel }: { value: string; label: string; source: string; sourceLabel: string }) {
  return (
    <div className="flex h-full flex-col gap-1.5 rounded-well bg-accent p-5 text-on-accent">
      <span className="type-figure">{value}</span>
      <span className="type-body">{label}</span>
      <span className="type-tag mt-auto pt-2">
        {sourceLabel}: {source}
      </span>
    </div>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="type-lead grid gap-4 text-fg">
      {items.map((item) => (
        <li key={item} className="grid grid-cols-[2rem_1fr] items-start gap-3">
          <span aria-hidden="true" className="type-label grid size-8 place-items-center rounded-full bg-accent text-on-accent">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PhoneSlot({ children }: { children: ReactNode }) {
  return (
    <div className="w-60 shrink-0 rounded-[2.5rem] border-2 border-night-line bg-night p-3 shadow-float sm:w-64">
      <div className="grid aspect-[9/19] place-items-center overflow-hidden rounded-[1.875rem] bg-canvas-tint p-4 text-center">{children}</div>
    </div>
  );
}

function initials(name: string) {
  return name.slice(0, 1).toUpperCase();
}

export function Header({ t, language, onLanguage }: { t: Pick<PitchCopy, "byDigi" | "languageLabel">; language: Language; onLanguage: (language: Language) => void }) {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-line bg-canvas px-4 sm:px-8">
      <div className="mx-auto flex h-20 max-w-content items-center justify-between gap-2">
        <Brand href={PRODUCT_PAGE} />
        <LanguageSwitch label={t.languageLabel} language={language} onLanguage={onLanguage} />
      </div>
    </header>
  );
}

export function Pitch() {
  const [language, setLanguage] = useState<Language>("en");
  const t = pitchCopy[language];
  const todoLabel = t.todoLabel;

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
        <section aria-labelledby="pitch-titlu" className="bg-canvas px-4 py-18 sm:px-8 lg:py-28">
          <div className="mx-auto grid w-full max-w-content items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="type-eyebrow mb-6 text-accent">{t.hero.event}</p>
              <h1 id="pitch-titlu" className="type-h1 text-fg">
                Infrared
              </h1>
              <p className="type-h3 mt-2 text-fg-muted">{t.byDigi}</p>
              <p className="type-h2 mt-8 max-w-[24ch] text-fg">
                <Fill slot={t.hero.tagline} label={todoLabel} />
              </p>
              <p className="type-lead mt-6 max-w-[40ch] text-fg-muted">{t.hero.lead}</p>
              <p className="type-lead mt-6 max-w-[40ch] rounded-well border-2 border-accent bg-surface px-5 py-4 font-semibold text-fg">{t.hero.noInstall}</p>
            </div>
            <AnimatedMascot animations={["mood_ok", "wiggle"]} className="size-44 justify-self-center lg:size-64" />
          </div>
        </section>

        <Band id="obligatii" label={t.duty.label} title={t.duty.title} mascot={["mood_warn", "look"]} tint>
          <LawPicker key={language} laws={t.duty.laws} sourceLabel={t.sourceLabel} />
        </Band>

        <Band id="problema" label={t.problem.label} title={t.problem.title} mascot={["mood_danger", "tilt"]}>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {t.problem.figures.map((figure, index) => (
              <li key={figure.value} data-reveal style={revealDelay(index)} className="data-shown:animate-pop">
                <FigureCard {...figure} sourceLabel={t.sourceLabel} />
              </li>
            ))}
          </ul>
          <div className="mt-12">
            <figure className={`m-0 max-w-3xl ${CARD}`}>
              <h3 className="type-h3 text-fg">{t.problem.voicesLabel}</h3>
              <p className="type-body text-fg-muted">{t.problem.voicesStats}</p>
              <ul className="grid gap-3">
                {t.problem.voices.map((voice) => (
                  <li key={voice} className="type-lead rounded-well bg-canvas-tint px-4 py-3 text-fg">
                    {voice}
                  </li>
                ))}
              </ul>
              <figcaption className="type-tag text-fg-muted">
                {t.sourceLabel}: {t.problem.voicesSource}
              </figcaption>
            </figure>
          </div>
        </Band>

        <Band id="solutia" label={t.solution.label} title={t.solution.title} mascot={["mood_ok", "talk"]} tint>
          <div className="mt-10 grid items-center gap-12 lg:grid-cols-[1fr_auto]">
            <CheckList items={t.solution.points} />
            <figure className="m-0 grid justify-items-center gap-3">
              <img
                src="/wa-chat-ro.webp"
                alt={t.solution.chatAlt}
                width={835}
                height={1704}
                loading="lazy"
                className="w-[min(18rem,70vw)] rounded-[calc(min(18rem,70vw)*0.1186)] shadow-float"
              />
              <figcaption className="type-tag text-fg-muted">{t.solution.chatNote}</figcaption>
            </figure>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <SideList title={t.solution.providerLabel} items={t.solution.provider} />
            <SideList title={t.solution.herLabel} items={t.solution.her} />
          </div>
        </Band>

        <Band id="cum" label={t.how.label} title={t.how.title}>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.how.steps.map((step, index) => (
              <li key={step.title} data-reveal style={revealDelay(index)} className={`data-shown:animate-pop ${CARD}`}>
                <span aria-hidden="true" className="type-numeral grid size-12 place-items-center rounded-full bg-accent text-on-accent">
                  {index + 1}
                </span>
                <h3 className="type-h3 text-fg">{step.title}</h3>
                <p className="type-body text-fg-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Band>

        <Band id="produs" label={t.product.label} title={t.product.title} tint>
          <ul className="mt-10 flex flex-wrap justify-center gap-10">
            {t.product.screens.map((screen) => (
              <li key={screen.name} className="grid justify-items-center gap-4">
                <PhoneSlot>
                  <Placeholder slot={screen.shot} label={todoLabel} />
                </PhoneSlot>
                <span className="type-h4 text-fg">{screen.name}</span>
              </li>
            ))}
          </ul>
        </Band>

        <Band id="concurenta" label={t.competition.label} title={t.competition.title}>
          <div className="mt-10 overflow-x-auto rounded-card border-2 border-line bg-surface">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className="type-label text-fg-muted">
                  <th scope="col" className="p-4">
                    <span className="sr-only">{t.competition.label}</span>
                  </th>
                  <th scope="col" className="p-4">{t.competition.does}</th>
                  <th scope="col" className="p-4">{t.competition.lacks}</th>
                </tr>
              </thead>
              <tbody className="type-body">
                {t.competition.rivals.map((rival) => (
                  <tr key={rival.name} className="border-t-2 border-line">
                    <th scope="row" className="type-label p-4 text-fg">{rival.name}</th>
                    <td className="p-4 text-fg-muted">{rival.does}</td>
                    <td className="p-4 text-fg">{rival.lacks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 flex flex-col items-start gap-4 rounded-card border-2 border-accent bg-surface p-6">
            <p className="type-eyebrow text-accent">{t.competition.edgeLabel}</p>
            <p className="type-lead text-fg">{t.competition.edge}</p>
            <Placeholder slot={t.competition.check} label={todoLabel} />
          </div>
        </Band>

        <Band id="piata" label={t.market.label} title={t.market.title} mascot={["mood_ok", "idle"]} tint>
          <h3 className="type-h4 mt-10 text-fg">{t.market.marketLabel}</h3>
          <ul className="mt-4 grid gap-6 md:grid-cols-3">
            {t.market.market.map((figure, index) => (
              <li key={figure.value} data-reveal style={revealDelay(index)} className="data-shown:animate-pop">
                <FigureCard {...figure} sourceLabel={t.sourceLabel} />
              </li>
            ))}
          </ul>

          <h3 className="type-h4 mt-12 text-fg">{t.market.contractLabel}</h3>
          <div className="mt-4 grid gap-4 rounded-card border-2 border-accent bg-surface p-6">
            <p className="type-lead text-fg">{t.market.contractLead}</p>
            <ol className="grid gap-3">
              {t.market.contract.map((clause, index) => (
                <li key={clause} className="type-body grid grid-cols-[2.5rem_1fr] items-start gap-3 text-fg">
                  <span aria-hidden="true" className="type-label grid size-9 place-items-center rounded-full bg-accent text-on-accent">
                    {index + 1}
                  </span>
                  <span className="pt-1">{clause}</span>
                </li>
              ))}
            </ol>
          </div>

          <h3 className="type-h4 mt-12 text-fg">{t.market.moneyLabel}</h3>
          <p className="type-body mt-2 max-w-[60ch] text-fg-muted">{t.market.moneyNote}</p>
          <dl className="mt-4 grid gap-4 md:grid-cols-2">
            {t.market.money.map((row) => (
              <div key={row.name} className={CARD}>
                <dt className="type-label text-fg-muted">{row.name}</dt>
                <dd className="type-figure m-0 text-accent">{row.value}</dd>
                <dd className="type-tag m-0 text-fg-muted">{row.how}</dd>
              </div>
            ))}
          </dl>

          <h3 className="type-h4 mt-12 text-fg">{t.market.rolloutLabel}</h3>
          <ol className="mt-4 grid gap-6 md:grid-cols-3">
            {t.market.rollout.map((step, index) => (
              <li key={step.title} data-reveal style={revealDelay(index)} className={`data-shown:animate-pop ${CARD}`}>
                <span aria-hidden="true" className="type-numeral grid size-12 place-items-center rounded-full bg-accent text-on-accent">
                  {index + 1}
                </span>
                <h4 className="type-h3 text-fg">{step.title}</h4>
                <p className="type-body text-fg-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Band>

        <Band id="cifre" label={t.numbers.label} title={t.numbers.title} mascot={["mood_ok", "look"]}>
          <h3 className="type-h4 mt-10 text-fg">{t.numbers.measuredLabel}</h3>
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t.numbers.measured.map((item, index) => (
              <li key={item.value} data-reveal style={revealDelay(index)} className={`data-shown:animate-pop ${CARD}`}>
                <span className="type-figure text-accent">{item.value}</span>
                <span className="type-body text-fg">{item.label}</span>
              </li>
            ))}
          </ul>
          <h3 className="type-h4 mt-12 text-fg">{t.numbers.targetsLabel}</h3>
          <dl className="mt-4 grid gap-4 md:grid-cols-3">
            {t.numbers.targets.map((target) => (
              <div key={target.label} className={CARD}>
                <dt className="type-label text-fg">{target.label}</dt>
                <dd className="m-0">
                  <Fill slot={target.value} label={todoLabel} />
                </dd>
              </div>
            ))}
          </dl>
        </Band>

        <Band id="acum" label={t.whyNow.label} title={t.whyNow.title} tint>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className={CARD}>
              <h3 className="type-h3 text-fg">{t.whyNow.candidatesLabel}</h3>
              <ul className="grid gap-4">
                {t.whyNow.candidates.map((candidate) => (
                  <li key={candidate.source} className="grid gap-1">
                    <span className="type-body text-fg">{candidate.text}</span>
                    <span className="type-tag text-fg-muted">
                      {t.sourceLabel}: {candidate.source}
                    </span>
                  </li>
                ))}
              </ul>
              <Placeholder slot={t.whyNow.pick} label={todoLabel} />
            </div>
            <div className={CARD}>
              <h3 className="type-h3 text-fg">{t.whyNow.edgeLabel}</h3>
              <CheckList items={t.whyNow.edgePoints} />
            </div>
          </div>
        </Band>

        <section id="echipa" aria-labelledby="echipa-titlu" className="bg-canvas px-4 py-18 sm:px-8 lg:py-24">
          <div className="mx-auto w-full max-w-content">
            <p className="type-eyebrow mb-4 text-accent">{t.team.label}</p>
            <h2 id="echipa-titlu" className="type-h2 text-fg">
              <Fill slot={t.team.name} label={todoLabel} />
            </h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {t.team.members.map((member, index) => (
                <li key={member.name} data-reveal style={revealDelay(index)} className={`data-shown:animate-pop items-center text-center ${CARD}`}>
                  <span aria-hidden="true" className="type-h2 grid size-24 place-items-center rounded-full bg-accent text-on-accent">
                    {initials(member.name)}
                  </span>
                  <span className="type-h3 mt-2 text-fg">{member.name}</span>
                  <span className="type-body text-fg-muted">{member.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="final-titlu" className="bg-canvas px-4 py-18 text-center sm:px-8 lg:py-28">
          <div className="mx-auto flex w-full max-w-content flex-col items-center gap-8">
            <AnimatedMascot animations={["mood_ok", "wiggle"]} className="size-36" />
            <h2 id="final-titlu" className="type-h1 max-w-[20ch] text-fg">
              {t.closing.title}
            </h2>
            <a href={PRODUCT_PAGE} className={buttonClass("accent")}>
              {t.closing.back}
            </a>
            <p className="type-tag max-w-[52ch] text-fg-muted">{t.closing.disclaimer}</p>
          </div>
        </section>
      </main>
    </>
  );
}
