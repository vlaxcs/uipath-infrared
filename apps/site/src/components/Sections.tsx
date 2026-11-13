import type { Content, Device, DeviceState, Severity } from "../content";
import { FindArt } from "./FindArt";
import { Eyebrow, Heading, Section } from "./ui";

const SEVERITY_ICON: Record<Severity, string> = { high: "!", medium: "!", low: "i" };
const SEVERITY_COLOR: Record<Severity, string> = {
  high: "text-status-danger border-status-danger",
  medium: "text-status-warn border-status-warn",
  low: "text-status-fixed border-status-fixed",
};

const SEVERITIES: Severity[] = ["high", "medium", "low"];

export function Finds({ text }: { text: Content }) {
  return (
    <Section id="ce-gaseste" titleId="gaseste-titlu">
      <Eyebrow center>{text.finds.eyebrow}</Eyebrow>
      <Heading id="gaseste-titlu" center>
        {text.finds.title}
      </Heading>
      <p className="type-lead mx-auto mt-3 max-w-[46ch] text-center text-fg-muted">{text.finds.lead}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-3 lg:gap-5">
        {SEVERITIES.map((severity, group) => (
          <div key={severity} role="group" aria-labelledby={`gaseste-${severity}`}>
            <h3
              id={`gaseste-${severity}`}
              className={`type-label mb-3 flex items-center gap-2 border-b-2 pb-2 ${SEVERITY_COLOR[severity]}`}
            >
              <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-current">
                <span className="text-on-accent">{SEVERITY_ICON[severity]}</span>
              </span>
              {text.finds.severity[severity]}
            </h3>
            <ul className="grid gap-3">
              {text.finds.items
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.severity === severity)
                .map(({ item, index }) => (
                  // Corner radii nest: card (1.25rem) = badge tile (10px) + padding (0.5rem) + border (2px).
                  <li
                    key={item.name}
                    data-reveal
                    style={{ animationDelay: `${group * 120 + index * 40}ms` }}
                    className="flex items-center gap-4 rounded-well border-2 border-line bg-canvas-tint p-2 data-shown:animate-appear"
                  >
                    <FindArt
                      code={item.code}
                      severity={item.severity}
                      index={index}
                      className="size-16 rounded-[calc(var(--radius-well)-2px-0.5rem)]"
                    />
                    <div className="min-w-0 pr-2">
                      <h4 className="type-h4 text-fg">{item.name}</h4>
                      <p className="type-tag mt-1 text-fg-muted">{item.detail}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

const STATE_ICON: Record<DeviceState, string> = { danger: "!", warn: "?", fixed: "✓" };
const STATE_COLOR: Record<DeviceState, string> = {
  danger: "text-status-danger border-status-danger",
  warn: "text-status-warn border-status-warn",
  fixed: "text-status-fixed border-status-fixed",
};

function DeviceRow({ device }: { device: Device }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-item border-2 border-line bg-surface px-2.5 py-1.5">
      <span className="type-tag font-bold text-fg">{device.name}</span>
      <span className={`type-tag inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2 py-0.5 ${STATE_COLOR[device.state]}`}>
        <span aria-hidden="true" className="font-extrabold">
          {STATE_ICON[device.state]}
        </span>
        {device.status}
      </span>
    </li>
  );
}

// What each step looks like. These sit inside the card's "well" (padding 0.5rem), so their
// corners are the well's 1.25rem minus that padding: rounded-item (0.75rem).
function StepArt({ index, text }: { index: number; text: Content }) {
  if (index === 0) {
    return (
      <ul className="grid gap-1.5">
        {text.how.devices.map((device) => (
          <DeviceRow key={device.name} device={device} />
        ))}
      </ul>
    );
  }
  if (index === 1) {
    return (
      <p className="max-w-[94%] rounded-item rounded-tl-sm bg-bubble-in px-3 py-2.5 text-on-bubble shadow-lip-sm">
        <span className="type-tag block text-accent">Netpotu</span>
        <span className="type-body">{text.how.incoming}</span>
      </p>
    );
  }
  if (index === 2) {
    return (
      <div className="grid gap-2">
        <p aria-hidden="true" className="type-tag max-w-[80%] rounded-item rounded-tl-sm bg-bubble-in px-3 py-2 text-fg-muted opacity-70">
          <span className="line-clamp-2">{text.how.incoming}</span>
        </p>
        <p className="type-label ml-auto w-fit rounded-item rounded-tr-sm bg-bubble-out px-4 py-2.5 text-on-bubble shadow-lip-sm">
          {text.how.outgoing} <span aria-hidden="true">✓✓</span>
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <p className="type-label flex items-center gap-3 rounded-item border-2 border-status-fixed bg-surface px-3 py-2 text-status-fixed">
        <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-full bg-status-fixed text-on-accent">
          ✓
        </span>
        {text.how.checked}
      </p>
      <p className="type-label flex items-center justify-between gap-3 rounded-item border-2 border-dashed border-line px-3 py-2.5 text-fg-muted">
        {text.how.nextStep}
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
