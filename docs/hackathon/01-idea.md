# Idea phase -> one-page PRD

Decisions only. Rejected ideas and their reasons live in the decision log in `00-before.md`. The first idea (Wellboarder) is in `archive/`.

**The idea:** an agent that takes a company's cloud infrastructure, its product roadmap and its financial forecast, and re-plans the infrastructure across providers (hyperscalers and platforms such as Supabase). It produces the analysis, the new layout, an updated cost analysis, a migration plan and how high availability goes up or down. Configurable by HA, zones and cost optimisation.

| Step | Status |
| --- | --- |
| 1. Who do we target? | done |
| 2. What is their problem? | done; price goes in the form |
| 3. How do we get into their day? | done |
| 4. Business plan | skipped for now; one-off or cron, price from the form |
| 5. Design the product | done at PRD level; provider list left for the SPEC |
| 6. Branding | name done; Miruna proposes the rest |

## 1. Target

- **Buyer company:** start-ups and small enterprises.
- **Who signs:** CTOs and CFOs.
- **Day-to-day user:** the CTO.
- **MVP:** for start-ups, for now. Bill size not fixed.

## 2. Problem

- **What the CTO wants:** the best possible ratio of quality, functionality and price.
- **What stops them:** they need the data centralised, correctly and efficiently. Today it is scattered across different clusters.

**What it costs** (sources at the bottom):

| Claim | Source | Status |
| --- | --- | --- |
| 29% of IaaS and PaaS spend is wasted, the first rise in five years | Flexera State of the Cloud 2026, 753 respondents | self-reported estimate |
| 85% say managing cloud spend is their top challenge | Flexera 2026, via SHI | not found in Flexera's own release |
| cloud is ~10% of revenue at young tech companies; a quarter of CFOs report 13-20% or more | Cloud Capital, 100 CFOs, US and UK | small sample |
| 57% say their last major outage cost over 100,000 USD; 1 in 5 over 1M USD | Uptime Institute Annual Outage Analysis 2026 | primary source; the HA side |
| 83% of enterprises are evaluating moving workloads back to private cloud; ~half have repatriated some | Broadcom Private Cloud Outlook 2026 | vendor survey, enterprises not start-ups; supports the on-prem option |

**Competitors and what they miss:**

| Who | What they do | What they miss |
| --- | --- | --- |
| AWS Transform, Google Migration Center | agentic migration assessment, TCO model | each pulls towards its own cloud, mostly from on-prem |
| Trianz Concierto | agentic migration across AWS, Azure, GCP, through to cutover | enterprise and services-led; hyperscalers only |
| Vantage, CloudZero, Finout, Amnic | cost visibility and forecasting across clouds | they report and forecast spend; they don't re-plan the architecture or the HA |
| CAST AI | Kubernetes cost automation | Kubernetes only; doesn't see databases, storage or egress |
| Infracost | the cost of an infrastructure change, before deployment | prices a change you already designed; doesn't propose one |
| infra.new (YC) | AI dev tool that configures cloud infrastructure for cost and security | to check: whether it re-plans across providers from a roadmap |
| consultants | manual moves to Supabase, Neon, Vercel, R2 | one-off, by hand, no HA or forecast model |

Gap: nobody turns the financial roadmap into a re-planned architecture across hyperscalers, platforms and on-prem, with the cost delta, the HA delta and a migration plan.

## 3. Getting into their day

- **Channel:** a dashboard and Slack.

## 4. Business plan

- **Sold as:** one-off runs, or a recurring run (cron job).

## 5. Product design

- **The roadmap** is the project's financial roadmap.
- **On-prem is an option too, with its hidden costs:** if the company has no on-prem lab, the plan covers setting one up: what it costs, its configuration (cooling, disk replacement and the rest), and its risks. *From the jury.*
- **Sources:** we choose the data sources. Each run produces several analyses, and the CTO (our client) picks which ones carry into the following plans. *From the jury.*
- **Demo data:** a few mocked projects, each with a deliberately bad infrastructure, running locally in Floci or another AWS emulator. The agent runs on each one and shows its results.

## 6. Branding

- **Name:** Infrared.
- **Palette, mascot, logo:** Miruna proposes them.

## Open questions

- Step 2: how much would the CTO pay? Ask it directly in the form.

## Sources

- [Flexera: cloud value rising while AI waste grows (2026)](https://www.flexera.com/about-us/press-center/flexera-finds-cloud-value-is-rising-while-ai-waste-grows)
- [SHI: 5 FinOps takeaways from Flexera 2026](https://blog.shi.com/business-of-it/software-licensing/finops-flexera-report/)
- [CFOtech: CFOs tighten grip as rising cloud costs hit tech margins (Cloud Capital survey)](https://cfotech.co.uk/story/cfos-tighten-grip-as-rising-cloud-costs-hit-tech-margins)
- [Uptime Institute: Annual Outage Analysis 2026](https://www.businesswire.com/news/home/20260513289344/en/Uptime-Announces-Annual-Outage-Analysis-Report-2026)
- [Broadcom 2026 survey, via StorageReview](https://storagereview.com/news/broadcom-2026-survey-cost-overtakes-security-as-top-public-cloud-concern)
- [AWS Transform agentic migration assessment](https://aws.amazon.com/about-aws/whats-new/2026/05/assessment-capabilities-transform)
- [Google Migration Center quick assessments, via IT Brief](https://itbrief.co.uk/story/google-cloud-adds-quick-ai-migration-cost-assessments)
- [Trianz Concierto Agentic Migrate](https://www.trianz.com/concierto/agentic-migration)
- [CAST AI vs Infracost](https://toolradar.com/compare/cast-ai-vs-infracost)
- [Amnic: Vantage alternatives](https://amnic.com/blogs/vantage-alternatives)
