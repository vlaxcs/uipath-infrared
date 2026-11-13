# Infrared PRD

MVP for the UiPath hackathon "Agents in Action". Built from the decisions in `docs/hackathon/01-idea.md`; reasons and rejected ideas are in the decision log in `docs/hackathon/00-before.md`.

## What it is

An agent that takes a company's cloud infrastructure and its project's financial roadmap, and re-plans the infrastructure across providers: hyperscalers, platforms such as Supabase, and on-prem. Each run produces:
- the analysis of the current infrastructure;
- the new layout;
- an updated cost analysis;
- a migration plan;
- how high availability goes up or down.

Configurable by HA, zones and cost optimisation.

## Who pays

- **Buyer:** start-ups and small enterprises. The MVP targets start-ups.
- **Who signs:** CTOs and CFOs.
- **Day-to-day user:** the CTO.

## The problem

The CTO wants the best ratio of quality, functionality and price. To get it they need their data centralised, correctly and efficiently; today it is scattered across different clusters.

## Why now

- Wasted cloud spend is at 29% of IaaS and PaaS spend, and rose for the first time in five years (Flexera 2026, self-reported).
- Cloud is ~10% of revenue at young tech companies; a quarter of CFOs report 13-20% or more (Cloud Capital, 100 CFOs).
- 57% say their last major outage cost over 100,000 USD (Uptime Institute 2026).
- 83% of enterprises are evaluating moving workloads back to private cloud (Broadcom 2026, vendor survey).

## Why it's different

Existing tools each cover one piece: hyperscaler assessments pull towards their own cloud, FinOps tools report and forecast spend, CAST AI covers Kubernetes only, Infracost prices a change you already designed. Nobody turns the financial roadmap into a re-planned architecture across hyperscalers, platforms and on-prem, with the cost delta, the HA delta and a migration plan. infra.new (YC) is still to check.

## Product

- **Input:** the project's financial roadmap and its current infrastructure.
- **On-prem is an option, with its hidden costs:** when the company has no on-prem lab, the plan covers setting one up: what it costs, its configuration (cooling, disk replacement and the rest), and its risks.
- **Sources:** we choose the data sources. Each run produces several analyses; the CTO picks which ones carry into the following plans.
- **Channel:** a dashboard and Slack.

## How we make money

Sold as one-off runs, or as a recurring run (cron job). The price comes from the validation form.

## MVP demo

A few mocked projects, each with a deliberately bad infrastructure, running locally in Floci or another AWS emulator. The agent runs on each one and shows its results.

## Open

- The price the CTO would pay: asked in the form.
- Which providers the agent can move to: decided in the SPEC.
- infra.new: check whether it already does this.

## Sources

- [Flexera State of the Cloud 2026](https://www.flexera.com/about-us/press-center/flexera-finds-cloud-value-is-rising-while-ai-waste-grows)
- [Cloud Capital survey, via CFOtech](https://cfotech.co.uk/story/cfos-tighten-grip-as-rising-cloud-costs-hit-tech-margins)
- [Uptime Institute Annual Outage Analysis 2026](https://www.businesswire.com/news/home/20260513289344/en/Uptime-Announces-Annual-Outage-Analysis-Report-2026)
- [Broadcom Private Cloud Outlook 2026, via StorageReview](https://storagereview.com/news/broadcom-2026-survey-cost-overtakes-security-as-top-public-cloud-concern)
- [infra.new, Y Combinator](https://www.ycombinator.com/companies/infranew)
