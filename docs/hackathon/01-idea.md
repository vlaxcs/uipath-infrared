# Idea phase -> one-page PRD

Decisions only. Rejected ideas and their reasons live in the decision log in `00-before.md`. The first idea (Wellboarder) is in `archive/`.

**The idea:** an agent that takes a company's cloud infrastructure, its product roadmap and its financial forecast, and re-plans the infrastructure across providers (hyperscalers and platforms such as Supabase). It produces the analysis, the new layout, an updated cost analysis, a migration plan and how high availability goes up or down. Configurable by HA, zones and cost optimisation.

| Step | Status |
| --- | --- |
| 1. Who do we target? | done |
| 2. What is their problem? | in progress |
| 3. How do we get into their day? | |
| 4. Business plan | |
| 5. Design the product | |
| 6. Branding | |

## 1. Target

- **Buyer company:** start-ups and small enterprises.
- **Who signs:** CTOs and CFOs.
- **Day-to-day user:** the CTO.
- **MVP:** for start-ups, for now. Bill size not fixed.

## 2. Problem

- **What the CTO wants:** the best possible ratio of quality, functionality and price.
- **What stops them:** they need the data centralised, correctly and efficiently. Today it is scattered across different clusters.

## 3. Getting into their day

## 4. Business plan

- **Sold as:** one-off runs, or a recurring run (cron job).

## 5. Product design

- **The roadmap** is the project's financial roadmap.
- **On-prem is an option too, with its hidden costs:** if the company has no on-prem lab, the plan covers setting one up: what it costs, its configuration (cooling, disk replacement and the rest), and its risks. *From the jury.*
- **Sources:** we choose the data sources. Each run produces several analyses, and the CTO (our client) picks which ones carry into the following plans. *From the jury.*
- **Demo data:** a few mocked projects, each with a deliberately bad infrastructure, running locally in Floci or another AWS emulator. The agent runs on each one and shows its results.

## 6. Branding

## Open questions
