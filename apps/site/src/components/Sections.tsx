import type { Content, Criterion, Resource, ResourceState } from "../content";
import { Eyebrow, Heading, Section } from "./ui";

export function Run({ text }: { text: Content }) {
  const run = text.run;
  return (
    <Section id="run" titleId="run-titlu">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>{run.eyebrow}</Eyebrow>
          <Heading id="run-titlu">{run.title}</Heading>
        </div>
        <figure
          data-reveal
          aria-label={run.label}
          className="m-0 w-full max-w-xl rounded-card border-2 border-line bg-surface p-2.5 shadow-float data-shown:animate-appear"
        >
          <figcaption className="type-tag flex items-center gap-2 px-3 pt-2 pb-3 text-fg-muted">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />
            {run.label}
          </figcaption>
          <ol className="grid gap-1.5 rounded-well bg-screen p-3">
            {run.steps.map((step) => (
              <li key={step.stage} className="type-tag grid grid-cols-[1.25rem_7rem_1fr] items-baseline gap-2">
                <span aria-hidden="true" className="text-status-fixed">
                  ✓
                </span>
                <span className="text-fg">{step.stage}</span>
                <span className="text-fg-muted">{step.result}</span>
              </li>
            ))}
          </ol>
          <p className="type-tag flex items-center gap-3 px-3 pt-3 pb-2 text-fg">
            <span aria-hidden="true" className="text-accent">
              →
            </span>
            {run.status}
          </p>
        </figure>
      </div>
    </Section>
  );
}

const CRITERIA: Criterion[] = ["cost", "availability", "database"];
const CRITERION_GLYPH: Record<Criterion, string> = { cost: "$", availability: "↑", database: "≡" };

export function Finds({ text }: { text: Content }) {
  return (
    <Section id="ce-gaseste" titleId="gaseste-titlu">
      <Eyebrow center>{text.finds.eyebrow}</Eyebrow>
      <Heading id="gaseste-titlu" center>
        {text.finds.title}
      </Heading>
      <div className="mt-8 grid gap-8 lg:grid-cols-3 lg:gap-5">
        {CRITERIA.map((criterion, group) => (
          <div key={criterion} role="group" aria-labelledby={`gaseste-${criterion}`}>
            <h3 id={`gaseste-${criterion}`} className="type-label mb-3 flex items-center gap-2 border-b-2 border-accent pb-2 text-fg">
              <span aria-hidden="true" className="type-tag grid size-6 place-items-center rounded-full bg-accent text-on-accent">
                {CRITERION_GLYPH[criterion]}
              </span>
              {text.finds.criteria[criterion]}
            </h3>
            <ul className="grid gap-3">
              {text.finds.items
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.criterion === criterion)
                .map(({ item, index }) => (
                  <li
                    key={item.name}
                    data-reveal
                    style={{ animationDelay: `${group * 120 + index * 40}ms` }}
                    className="rounded-well border-2 border-line bg-canvas-tint px-4 py-3 data-shown:animate-appear"
                  >
                    <h4 className="type-h4 text-fg">{item.name}</h4>
                    <p className="type-tag mt-1 text-fg-muted">{item.detail}</p>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

const STATE_ICON: Record<ResourceState, string> = { danger: "!", warn: "?", fixed: "✓" };
const STATE_COLOR: Record<ResourceState, string> = {
  danger: "text-status-danger border-status-danger",
  warn: "text-status-warn border-status-warn",
  fixed: "text-status-fixed border-status-fixed",
};

function ResourceRow({ resource }: { resource: Resource }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-item border-2 border-line bg-surface px-2.5 py-1.5">
      <span className="type-tag font-bold text-fg">{resource.name}</span>
      <span className={`type-tag inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2 py-0.5 ${STATE_COLOR[resource.state]}`}>
        <span aria-hidden="true" className="font-extrabold">
          {STATE_ICON[resource.state]}
        </span>
        {resource.status}
      </span>
    </li>
  );
}

function CheckRow({ label, tone = "fg" }: { label: string; tone?: "fg" | "fixed" }) {
  return (
    <li className={`type-tag flex items-center gap-2 rounded-item border-2 border-line bg-surface px-2.5 py-1.5 ${tone === "fixed" ? "text-status-fixed" : "text-fg"}`}>
      <span aria-hidden="true" className="text-accent">
        ✓
      </span>
      {label}
    </li>
  );
}

// What each step looks like. These sit inside the card's "well" (padding 0.5rem), so their
// corners are the well's 1.25rem minus that padding: rounded-item (0.75rem).
function StepArt({ index, text }: { index: number; text: Content }) {
  if (index === 0) {
    return (
      <ul className="grid gap-1.5">
        {text.how.resources.map((resource) => (
          <ResourceRow key={resource.name} resource={resource} />
        ))}
      </ul>
    );
  }
  if (index === 1) {
    return (
      <ul className="grid gap-1.5">
        {text.how.criteria.map((criterion) => (
          <CheckRow key={criterion} label={criterion} />
        ))}
      </ul>
    );
  }
  if (index === 2) {
    const last = text.how.rehearsal.length - 1;
    return (
      <ul className="grid gap-1.5">
        {text.how.rehearsal.map((line, row) => (
          <CheckRow key={line} label={line} tone={row === last ? "fixed" : "fg"} />
        ))}
      </ul>
    );
  }
  return (
    <div className="grid gap-2">
      <p className="type-label flex items-center gap-3 rounded-item border-2 border-accent bg-surface px-3 py-2 text-fg">
        <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-full bg-accent text-on-accent">
          1
        </span>
        {text.how.change.current}
      </p>
      <p className="type-label flex items-center justify-between gap-3 rounded-item border-2 border-dashed border-line px-3 py-2.5 text-fg-muted">
        {text.how.change.next}
        <span aria-hidden="true">→</span>
      </p>
    </div>
  );
}

// Corner radii nest: card (2rem) = well (1.25rem) + card padding (0.75rem, 0.625rem + the 2px border).
function StepCard({ index, last, text }: { index: number; last: boolean; text: Content }) {
  const step = text.how.steps[index];
  return (
    <li
      data-reveal
      // Each card sits above the next one, so its arrow is never painted under the next card.
      style={{ animationDelay: `${index * 120}ms`, zIndex: text.how.steps.length - index }}
      className="relative flex flex-col rounded-card border-2 border-line bg-canvas-tint p-2.5 shadow-lip data-shown:animate-appear"
    >
      <div className="grid min-h-46 content-center rounded-well bg-screen p-2">
        <StepArt index={index} text={text} />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 pt-4 pb-3">
        <div className="flex min-h-[3.25rem] items-center gap-3">
          <span aria-hidden="true" className="type-numeral grid size-10 flex-none place-items-center rounded-full bg-accent text-on-accent">
            {index + 1}
          </span>
          <h3 className="type-h3 text-fg">{step.title}</h3>
        </div>
        <p className="text-fg-muted">{step.body}</p>
      </div>
      {!last && (
        <>
          <span
            aria-hidden="true"
            className="absolute -bottom-7 left-1/2 z-10 grid size-8 -translate-x-1/2 place-items-center rounded-full bg-accent text-on-accent md:hidden"
          >
            ↓
          </span>
          <span
            aria-hidden="true"
            className="absolute top-26 -right-7 z-10 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-accent text-on-accent lg:grid"
          >
            →
          </span>
        </>
      )}
    </li>
  );
}

export function HowItWorks({ text }: { text: Content }) {
  const last = text.how.steps.length - 1;
  return (
    <Section id="cum-merge" titleId="cum-titlu" width="horizontal:w-max horizontal:min-w-screen" inner="horizontal:w-fit horizontal:max-w-none">
      <div className="relative">
        <Eyebrow>{text.how.eyebrow}</Eyebrow>
        <Heading id="cum-titlu">{text.how.title}</Heading>
        <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4 horizontal:mt-8 horizontal:grid-cols-[repeat(4,var(--step-column))]">
          {text.how.steps.map((step, index) => (
            <StepCard key={step.title} index={index} last={index === last} text={text} />
          ))}
        </ol>
        <p
          data-reveal
          className="type-label mt-10 inline-flex items-center gap-3 rounded-full border-2 border-accent px-5 py-3 text-fg data-shown:animate-appear horizontal:absolute horizontal:top-9 horizontal:right-0 horizontal:mt-0"
        >
          <span aria-hidden="true" className="text-accent">
            ✓
          </span>
          {text.how.promise}
        </p>
      </div>
    </Section>
  );
}

export function Pricing({ text }: { text: Content }) {
  return (
    <Section id="preturi" titleId="preturi-titlu">
      <Eyebrow center>{text.pricing.eyebrow}</Eyebrow>
      <Heading id="preturi-titlu" center>
        {text.pricing.title}
      </Heading>
      <ul className="mx-auto mt-8 grid max-w-3xl gap-5 md:grid-cols-2">
        {text.pricing.plans.map((plan, index) => (
          <li
            key={plan.name}
            data-reveal
            style={{ animationDelay: `${index * 120}ms` }}
            className="flex flex-col gap-3 rounded-card border-2 border-line bg-canvas-tint p-6 shadow-lip data-shown:animate-appear"
          >
            <h3 className="type-eyebrow text-accent">{plan.name}</h3>
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="type-figure text-fg">{plan.price}</span>
              <span className="type-tag text-fg-muted">{plan.unit}</span>
            </p>
            <p className="text-fg-muted">{plan.detail}</p>
          </li>
        ))}
      </ul>
      <p className="type-tag mx-auto mt-6 max-w-[60ch] text-center text-fg-muted">{text.pricing.compare}</p>
    </Section>
  );
}

export function Faq({ text }: { text: Content }) {
  return (
    <Section id="intrebari" titleId="intrebari-titlu">
      <Eyebrow center>{text.faq.eyebrow}</Eyebrow>
      <Heading id="intrebari-titlu" center>
        {text.faq.title}
      </Heading>
      <div className="mx-auto mt-8 grid max-w-3xl gap-3">
        {text.faq.items.map((item, index) => (
          <details
            key={item.q}
            name="intrebari"
            data-reveal
            style={{ animationDelay: `${index * 80}ms` }}
            className="group rounded-card border-2 border-line bg-canvas-tint shadow-lip data-shown:animate-appear"
          >
            {/* The summary sits inside the 2px border, so its corners are the card's minus 2px. */}
            <summary className="type-label relative cursor-pointer list-none rounded-[calc(var(--radius-card)-2px)] py-4 pr-14 pl-5 text-fg sm:py-5 sm:pr-16 sm:pl-6 [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden="true"
                className="type-numeral absolute top-1/2 right-5 -translate-y-1/2 text-accent transition-transform duration-200 group-open:rotate-45 sm:right-6"
              >
                +
              </span>
            </summary>
            <p className="type-body px-5 pb-5 text-fg-muted sm:px-6">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
