import type { Content, Criterion } from "../content";
import { ClusterGraph } from "./ClusterGraph";
import { TerminalRun } from "./TerminalRun";
import { Heading, Section } from "./ui";

export function Run({ text }: { text: Content }) {
  const run = text.run;
  return (
    <Section id="run" titleId="run-titlu" inner="max-w-[86rem]">
      <div className="grid gap-8 lg:grid-cols-[minmax(13rem,0.7fr)_minmax(0,2fr)] lg:items-start lg:gap-12">
        <div className="max-w-[32ch]">
          <Heading id="run-titlu">{run.title}</Heading>
          <p className="type-lead mt-5 text-fg-muted">{run.body}</p>
          <dl className="mt-8 grid gap-2 border-t border-line pt-3 font-mono text-[10px] text-fg-muted">
            <div className="flex items-baseline justify-between gap-4">
              <dt>mode</dt>
              <dd className="text-fg">read-only</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt>sources</dt>
              <dd className="tabular-nums text-fg">6</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt>steps</dt>
              <dd className="tabular-nums text-fg">4</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt>output</dt>
              <dd className="text-fg">pull request</dd>
            </div>
          </dl>
        </div>
        <TerminalRun label={run.label} copyLabel={run.copy} copiedLabel={run.copied} />
      </div>
    </Section>
  );
}

const CRITERIA: Criterion[] = ["cost", "availability", "database"];

export function Finds({ text }: { text: Content }) {
  const finds = text.finds;
  return (
    <Section id="ce-gaseste" titleId="gaseste-titlu" inner="relative max-w-none">
      <div className="relative -mr-5 overflow-hidden sm:-mr-8 horizontal:-mr-[clamp(2.5rem,5vw,5.5rem)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-end lg:gap-14">
          <div>
            <Heading id="gaseste-titlu">{finds.title}</Heading>
            <div className="mt-10 grid gap-8 md:grid-cols-3 lg:mt-8">
              {CRITERIA.map((criterion) => (
                <div key={criterion} role="group" aria-labelledby={`gaseste-${criterion}`}>
                  <h3 id={`gaseste-${criterion}`} className="border-t border-line-strong pt-3 font-mono text-[11px] font-medium text-fg">
                    {finds.criteria[criterion]}
                  </h3>
                  <ul>
                    {finds.items
                      .filter((item) => item.criterion === criterion)
                      .map((item) => (
                        <li key={item.name} className="border-b border-line py-3.5">
                          <h4 className="type-h4 text-fg">{item.name}</h4>
                          <p className="type-tag mt-1 max-w-[40ch] text-fg-muted">{item.detail}</p>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-w-0 self-end lg:overflow-hidden">
            <p className="font-mono text-[10px] text-fg-muted">{finds.waste.source}</p>
            <p className="mt-2 font-mono text-[clamp(6.5rem,20vw,18rem)] leading-[0.72] tracking-[-0.1em] text-fg">
              {finds.waste.value}
            </p>
            <div className="mt-4 border-t border-fg/25 pt-3 lg:max-w-[22rem]">
              <p className="type-tag text-fg">{finds.waste.label}</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function Cluster({ text }: { text: Content }) {
  return (
    <section
      id="plan"
      aria-labelledby="plan-titlu"
      className="relative flex min-h-svh snap-start flex-col overflow-hidden border-b border-line bg-canvas horizontal:h-full horizontal:min-h-0 horizontal:w-screen horizontal:flex-none horizontal:border-r horizontal:border-b-0"
    >
      <ClusterGraph copy={text.cluster} />
    </section>
  );
}

export function HowItWorks({ text }: { text: Content }) {
  return (
    <Section id="cum-merge" titleId="cum-titlu">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-3">
          <Heading id="cum-titlu">{text.how.title}</Heading>
        </div>
        <ol className="grid gap-8 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-4 lg:gap-6">
          {text.how.steps.map((step, index) => (
            <li key={step.title} className="border-t border-line-strong pt-3">
              <span aria-hidden="true" className="font-mono text-[11px] tabular-nums text-fg-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="type-h3 mt-6 text-fg">{step.title}</h3>
              <p className="type-tag mt-2 max-w-[30ch] text-fg-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

export function Pricing({ text }: { text: Content }) {
  const pricing = text.pricing;
  return (
    <Section id="preturi" titleId="preturi-titlu">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-3">
          <Heading id="preturi-titlu">{pricing.title}</Heading>
        </div>
        <div className="min-w-0 overflow-x-auto lg:col-span-9">
          <table className="w-full min-w-[22rem] border-collapse font-mono text-[11px] tabular-nums sm:min-w-[40rem]">
            <caption className="sr-only">{pricing.title}</caption>
            <thead>
              <tr className="border-y border-line-strong text-left text-fg-muted">
                <th scope="col" className="py-2.5 pr-4 font-normal">plan</th>
                <th scope="col" className="py-2.5 pr-4 text-right font-normal">price</th>
                <th scope="col" className="py-2.5 pr-4 font-normal">includes</th>
                <th scope="col" className="hidden py-2.5 font-normal sm:table-cell">detail</th>
              </tr>
            </thead>
            <tbody>
              {pricing.plans.map((plan) => (
                <tr key={plan.name} className="border-b border-line align-top">
                  <th scope="row" className="py-5 pr-4 text-left font-medium text-fg">
                    {plan.name}
                    <span className="mt-1 block font-mono text-[10px] font-normal text-fg-muted sm:hidden">
                      {plan.detail}
                    </span>
                  </th>
                  <td className="py-5 pr-4 text-right text-fg">{plan.price}</td>
                  <td className="py-5 pr-4 text-fg-muted">{plan.unit}</td>
                  <td className="hidden py-5 text-fg-muted sm:table-cell">{plan.detail}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="pt-4 text-fg-muted">{pricing.consultant}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-4 font-mono text-[10px] text-fg-muted">{pricing.billingNote}</p>
        </div>
      </div>
    </Section>
  );
}

export function Faq({ text }: { text: Content }) {
  return (
    <Section id="intrebari" titleId="intrebari-titlu">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-3">
          <Heading id="intrebari-titlu">{text.faq.title}</Heading>
        </div>
        <div className="border-t border-line-strong lg:col-span-9">
          {text.faq.items.map((item) => (
            <details key={item.q} className="group border-b border-line">
              <summary className="type-label flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-fg [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="font-mono text-[1.125rem] font-normal text-fg-muted transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="type-tag max-w-[65ch] pb-4 text-fg-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
