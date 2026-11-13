# Infrared

Infrared is an end-to-end agentic workflow that re-plans a company's infrastructure around the projects it runs. It analyses the current infrastructure against each internal project's known expectations, decides what should change for high availability, cost and zones, and shows step by step how to implement the change.

## Customers

| | |
| --- | --- |
| Buyer | start-ups and small enterprises; the MVP targets start-ups |
| Signs | the CTO and the CFO |
| Uses it day to day | the CTO |

Infrared is billed per company.

## Problem

A CTO wants the best ratio of quality, functionality and price from their infrastructure. Getting there needs the data behind the decision centralised, correctly and efficiently. Today that data is scattered across different clusters, so the decision is made with part of the picture.

## Why now

- Wasted cloud spend is 29% of IaaS and PaaS spend, and rose for the first time in five years (Flexera 2026, self-reported by 753 respondents).
- Cloud is about 10% of revenue at young tech companies; a quarter of CFOs report 13-20% or more (Cloud Capital, 100 CFOs).
- 57% of organisations say their last major outage cost over 100,000 USD; 1 in 5 over 1M USD (Uptime Institute 2026).
- 83% of enterprises are evaluating moving workloads from public cloud back to private infrastructure (Broadcom 2026, vendor survey).

## How it works

**Input**
- The client's current infrastructure.
- Their internal projects and what each one is expected to need, from the project's financial roadmap.

**Decision criteria**
1. High availability.
2. Cost reduction.
3. The zones wanted for each project.

**Where infrastructure can move**
- Hyperscalers.
- Platforms such as Supabase.
- On-prem. When the company has no on-prem lab, the plan includes setting one up: what it costs, how it is configured (cooling, disk replacement and the rest), and its risks.

**Output of a run**
- An analysis of the current infrastructure.
- The new layout.
- An updated cost analysis.
- How high availability goes up or down.
- A visualisation of the change, step by step, showing how it would be implemented.

**Control**
- Infrared chooses the data sources.
- Each run produces several analyses. The CTO picks which of them carry into the following plans.

**GitHub runners**
- Infrared reads the GitHub organisation's runners and suggests optimisations, or moving them on-prem.

## Channels

- A dashboard.
- Slack.
- A Chrome extension for the GitHub organisation.

## Competitive landscape

| Product | What it does | What it does not do |
| --- | --- | --- |
| AWS Transform, Google Migration Center | agentic migration assessment with a TCO model | each recommends its own cloud, mostly coming from on-prem |
| Trianz Concierto | agentic migration across AWS, Azure and GCP, through to cutover | enterprise and services-led; hyperscalers only |
| Vantage, CloudZero, Finout, Amnic | cost visibility and forecasting across clouds | they report and forecast spend; they do not re-plan the architecture or its availability |
| CAST AI | Kubernetes cost automation | Kubernetes only; does not see databases, storage or egress |
| Infracost | the cost of an infrastructure change, before deployment | prices a change already designed; does not propose one |
| Consultants | manual moves to platforms such as Supabase, Neon, Vercel, R2 | one-off and manual, with no availability or forecast model |

No product found turns a project's financial roadmap into a re-planned infrastructure across hyperscalers, platforms and on-prem, with the cost change, the availability change and the implementation steps.

## Business model

| Plan | Price |
| --- | --- |
| Run pack | 5 runs for 490 USD, about 98 USD a run |
| Subscription | 199 USD a month, with runs scheduled in the cloud |

How the prices compare:

| Alternative | What the client gets | Price |
| --- | --- | --- |
| Consultant cost review | one AWS review, report only | from 495 USD (Towards The Cloud); 2,000 USD (CloudVisor); 5,000-10,000 USD for a standalone audit (EaseCloud) |
| Vantage | cost visibility | Pro 30 USD a month up to 7,500 USD of tracked spend; Business 200 USD a month up to 20,000 USD |
| Infracost | the cost of a planned change, in CI | Starter 250 USD a month; Cloud 1,000 USD a month |

- The run pack costs less than the cheapest single consultant review, and each run also re-plans across providers, prices availability and on-prem, and lays out the implementation.
- The subscription is priced at Vantage Business, which shows spend only, and below Infracost Starter.

## MVP

- Demo projects, each with a deliberately poor infrastructure, running locally in Floci or another AWS emulator.
- Infrared runs on each project and shows its results.

## Open questions

- Prices: confirm with prospective clients, and measure Infrared's own cost per run (LLM calls) before fixing them.
- Which providers the MVP can move infrastructure to.
- Whether infra.new (YC) already does what Infrared does.
- Vantage's published prices disagree between sources (30/200 USD or 50/250 USD a month); this document uses the figure most sources agree on.

## Sources

- [Flexera State of the Cloud 2026](https://www.flexera.com/about-us/press-center/flexera-finds-cloud-value-is-rising-while-ai-waste-grows)
- [Cloud Capital survey, via CFOtech](https://cfotech.co.uk/story/cfos-tighten-grip-as-rising-cloud-costs-hit-tech-margins)
- [Uptime Institute Annual Outage Analysis 2026](https://www.businesswire.com/news/home/20260513289344/en/Uptime-Announces-Annual-Outage-Analysis-Report-2026)
- [Broadcom Private Cloud Outlook 2026, via StorageReview](https://storagereview.com/news/broadcom-2026-survey-cost-overtakes-security-as-top-public-cloud-concern)
- [AWS Transform agentic migration assessment](https://aws.amazon.com/about-aws/whats-new/2026/05/assessment-capabilities-transform)
- [Google Migration Center quick assessments, via IT Brief](https://itbrief.co.uk/story/google-cloud-adds-quick-ai-migration-cost-assessments)
- [Trianz Concierto Agentic Migrate](https://www.trianz.com/concierto/agentic-migration)
- [CAST AI vs Infracost](https://toolradar.com/compare/cast-ai-vs-infracost)
- [Vantage pricing, via nOps](https://www.nops.io/blog/vantage-pricing-explained/)
- [Infracost pricing](https://www.infracost.io/pricing)
- [CloudVisor AWS cost optimisation review](https://cloudvisor.co/services/cost-optimization)
- [Towards The Cloud AWS cost optimisation](https://towardsthecloud.com/services/aws-cost-optimization)
- [EaseCloud: AWS consulting pricing 2026](https://blog.easecloud.io/cost-optimization/aws-consulting-pricing-cost-guide/)
- [infra.new, Y Combinator](https://www.ycombinator.com/companies/infranew)
