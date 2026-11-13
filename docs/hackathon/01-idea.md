# Idea phase (2 hours) -> one-page PRD

Output of this phase: a one-page PRD the mentors validated. Who pays, what problem, why now, how we make money. Nothing in here is decided until it lands in the decision log in `00-before.md`.

| Step | Timebox | Status |
| --- | --- | --- |
| Kick-off | 10 min | in progress |
| 1. Who do we target? | 30 min | |
| 2. What is their problem? | 30 min | |
| 3. How do we get into their day? | 20 min | |
| 4. Business plan | 15 min | |
| 5. Design the product | 15 min | |
| 6. Branding | in parallel, designer | |

## Kick-off

- Scribe: Vlad (PM). Logs every decision and every rejected idea, with the reason, in `00-before.md`.
- Theme, out loud: build an agent that pursues a goal across multiple steps and uses intermediate results to pick its next step. A regular program, a fixed workflow or one LLM call loses points.
- Rubric, out loud: working result 30, user value 25, agent design 20, originality 15, usability and control 10.
- AI context: `00-before.md` (brief, rubric, UiPath profile) and `V:\enterpreyes\docs\prd.md`.

### The filter every idea passes

A target only stays on the table if its job answers yes to all three:
1. the path to the goal is not known up front, it depends on what the agent finds;
2. something can change, go missing or fail mid-run, and the agent has to react;
3. there is a risky action a human has to approve.

No to any of them? It's a program or a workflow, and it loses the 20 points for agent design.

### Tension to settle with a mentor

UiPath sells to large enterprises. The Enterpreyes PRD caps an instance at 500 people. Ask a mentor whether a start-up or SME buyer hurts the "user value" score in front of UiPath judges, or whether they don't care.

## 1. Who do we target? (30 min)

Buyers come from the PRD: founders of start-ups and SMEs up to 500 people. Which of their people the agent serves is open. Candidates taken from the PRD, run through the filter:

| # | Buyer | User | The job the agent does | Filter 1/2/3 | Note |
| --- | --- | --- | --- | --- | --- |
| A | CTO | engineers, platform admins | get the access a task needs across GCP and GitHub: find what's missing, route to approvers, apply, verify, revoke on expiry | yes / yes / yes | PRD pain: "a ticket per system, access rarely taken back" |
| B | CTO, COO | platform admins | find and fix risky paths in their own GCP: scan, fix, re-scan until confirmed | yes / yes / yes | the closest to the brief's "investigate and fix a bug" |
| C | founder, COO | HR | worked hours and leave without spreadsheets | no / partly / no | the PRD's validated pain, but the hours math is a regular program |
| D | founder | commercial | follow a deal after it becomes a project | partly / partly / no | reads like a report, not an agent |
| E | founder | hiring managers | from an open position to an onboarded hire | partly / yes / yes | PRD and EU AI Act: our AI never ranks candidates, which cuts most of the agency |

Questions for mentors in this step:
- which of these users do you see as a real paying customer?
- do you know any company that has this pain today, so we can ask them?
- does UiPath want its own stack integrated (Maestro, Action Center), or is OpenRouter enough?
