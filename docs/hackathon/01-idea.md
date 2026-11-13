# Idea phase (2 hours) -> one-page PRD

Output of this phase: a one-page PRD the mentors validated. Who pays, what problem, why now, how we make money. Nothing in here is decided until it lands in the decision log in `00-before.md`.

| Step | Timebox | Status |
| --- | --- | --- |
| Kick-off | 10 min | in progress |
| 1. Who do we target? | 30 min | done, mentors to confirm |
| 2. What is their problem? | 30 min | in progress |
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

### Decided: start-ups and small enterprises, employee experience and HR efficiency

Buyer: the founder or COO. Two users the same agent has to serve: the employee, who gets an answer or a result instead of a form, and HR, who stops doing it by hand. Which job is still open. HR and employee jobs from the PRD, through the filter:

| # | Job | Why it is an agent | Filter 1/2/3 | Risk |
| --- | --- | --- | --- | --- |
| H1 | Employee request on Slack: "I'm off next Friday", "I'm moving to 4 days a week" | reads balance, contract type, legal holidays, team coverage; the approver is out of office? reroutes up the org chart; missing proof? asks for it | yes / yes / yes (manager approves) | needs a Slack app and Calendar |
| H2 | Onboarding a new hire | the checklist exists, but the agent chases blockers: account not created, legal task (REVISAL) late, buddy on leave, equipment missing; HR approves contract and permissions | partly / yes / yes | the closest to a fixed workflow; the demo has to show the replanning |
| H3 | Offboarding a leaver | finds access left behind everywhere (GCP, GitHub, groups), the final hours summary, retention per kind of data; HR and IT approve every revocation | yes / yes / yes | HR and security together; the "employee experience" part is weak |
| H4 | Employee asks HR anything ("how much leave do I have left, why was my overtime cut?") | retrieval over contract, hours and policy, then acts if needed | partly / partly / no | close to a single LLM call with RAG |

### Decided: the employee lifecycle, onboarding to offboarding

The MVP workflows are cut in step 5 so they fit the deadline.

## 2. What is their problem? (30 min)

### Problem statements, from the team

1. **The same onboarding goes differently from one office to another.** The manager is away on the first day, the buddy isn't delegated in time, the accesses the job needs are wrong or incomplete, and nobody finds out until the new hire is already blocked.
2. **HR in a small start-up mixes steps that are agentic with steps that aren't.** Some are fixed rules (generate the contract, register in REVISAL before day one), some need judgement and chasing (who covers for the absent manager, which access is actually missing). Today one person holds both in their head, or in a spreadsheet.
3. **Offboarding leaves access behind.** (From the PRD: "access given once is rarely taken back".)

Statement 2 is also our pitch for "why an agent": the product runs the fixed steps as a workflow and hands to the agent only the steps whose path depends on what it finds. That split is what UiPath sells with Maestro (agents, robots and people in one process), so judges will recognise it.

### Data that proves the problem (sources at the bottom)

| Claim | Source | Status |
| --- | --- | --- |
| only 12% of employees strongly agree their organisation does a great job of onboarding | Gallup, 2019 perspective paper | primary source, year to confirm on gallup.com |
| when the manager takes an active part, employees are 3.4x more likely to call their onboarding successful | Gallup | supports statement 1 (absent manager) |
| 44% of organisations aren't confident former employees were removed from the network; a quarter take over a week to deprovision | OneLogin survey, 2017 | old, look for something newer |
| 70% lack confidence that former employees' accounts are deactivated in time; 14% remove access immediately on an HR status change | One Identity | date to confirm |

Missing: a number on the cost of a bad onboarding in a start-up (time to productivity, early leavers), and something on HR load in companies under 50 people.

### Competitors and what they miss (to verify, not researched yet)

| Who | What they do | What we think they miss |
| --- | --- | --- |
| Factorial, Personio, HiBob, BambooHR | HR suites with onboarding and offboarding checklists | the checklist doesn't replan when the manager or buddy is missing |
| Rippling | HR plus provisioning and deprovisioning of apps | priced and built for larger companies; access is per app, not per task |
| ad hoc: Notion or a spreadsheet, plus Slack | what most small start-ups use | everything by hand |

### Questions for the validation form (Discord, LinkedIn, mentors)

1. How many people work at your company, and who does HR?
2. At the last hire: what wasn't ready on day one? (accounts, access, equipment, manager, buddy, contract)
3. How many days until the new person could do real work?
4. At the last departure: how sure are you that every access was removed?
5. What do you use today for onboarding and offboarding?
6. How much would you pay per employee per month for this to run on its own, with you approving only the important steps? (0, 1-3, 3-5, 5-10, 10+ EUR)

### The lifecycle, split by type (input for step 5)

| Stage | Fixed rule (workflow) | Needs the agent | Human approves |
| --- | --- | --- | --- |
| offer accepted | create the account from the template | | HR: contract, permissions |
| before day one | generate the contract, legal tasks with deadlines | check the manager and buddy are available on the start date; propose a replacement if not | manager: replacement |
| access | apply the position's template | find the access the first tasks actually need, missing from the template | owner of each access |
| first weeks | checklist reminders | chase blocked items, re-plan the order | |
| offboarding | final hours summary, retention per kind of data | find access left behind everywhere | HR and IT: every revocation |

EU AI Act line, all jobs: the agent routes, explains and prepares. A human approves anything that decides something about a person.

Questions for mentors in this step:
- which of these users do you see as a real paying customer?
- do you know any company that has this pain today, so we can ask them?
- does UiPath want its own stack integrated (Maestro, Action Center), or is OpenRouter enough?

## Sources

- [Gallup: Perspective on creating an exceptional onboarding journey (PDF)](https://www.gallup.com/file/workplace/247076/Gallup_Perspective_on_Creating_an_Exceptional_Onboarding_Journey_for_Your_New_Employees.pdf)
- [Gallup: onboarding new employees](https://www.gallup.com/workplace/235121/onboarding-new-employees.aspx)
- [OneLogin 2017 survey, via BetaNews](https://betanews.com/2017/07/18/exemployees-access-corporate-apps)
- [One Identity on dormant accounts, via Identity Week](https://identityweek.net/one-identity-finds-that-dormant-accounts-pose-major-risk/)
