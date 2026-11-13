# Idea phase (2 hours) -> one-page PRD

Output of this phase: a one-page PRD the mentors validated. Who pays, what problem, why now, how we make money. Nothing in here is decided until it lands in the decision log in `00-before.md`.

| Step | Timebox | Status |
| --- | --- | --- |
| Kick-off | 10 min | in progress |
| 1. Who do we target? | 30 min | done, mentors to confirm |
| 2. What is their problem? | 30 min | framed, needs form answers |
| 3. How do we get into their day? | 20 min | done |
| 4. Business plan | 15 min | in progress, waits for form answers |
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

### What it costs: money and risk

| Cost | Figure | Source | Status |
| --- | --- | --- | --- |
| replacing someone who leaves | 50-200% of annual salary, depending on level | attributed to SHRM, via vendor blogs | find the SHRM original before quoting |
| cost per hire, before ramp-up and vacancy | ~4,700 USD | attributed to SHRM | same |
| leaving in the first 90 days | 24% of respondents have done it (Employ, 2024); "1 in 3" (Jobvite) | vendor blogs | pick one, cite the original |
| window to win a new hire over | 44 days on average | BambooHR, via a vendor blog | soft, use as framing only |
| breach started by a malicious insider | 4.92M USD on average, the costliest vector; 260 days to resolve | IBM Cost of a Data Breach 2025 | primary source; it doesn't separate out former employees |
| personal data breach under GDPR | fines up to 20M EUR or 4% of global turnover | GDPR art. 83 | law |

Risks with no clean number yet:
- **security:** a former employee who still has access to GCP, GitHub or Workspace (see the offboarding surveys above);
- **legal (Romania):** a contract not registered in REVISAL before the first day; fine amount to confirm in the Labour Code;
- **legal (GDPR):** access to personal data kept after it is no longer needed;
- **people:** the new hire's first week with no manager, no buddy and no access, the thing Gallup ties to the 12%.

Example for the pitch, an assumption Finance has to check: a start-up that loses one hire in the first 90 days, on a 40,000 EUR salary, loses at least 20,000 EUR at the lowest end of the SHRM range.

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
7. How many people did you hire, and how many left, in the last 12 months?
8. Would you rather pay per employee per month, or per hire and per departure?

### The lifecycle, split by type (input for step 5)

Onboarding is internal. It starts the moment the person accepts the offer and signs the agreement. Recruiting, the offer and the signing stay outside the product.

| Stage | Fixed rule (workflow) | Needs the agent | Human approves |
| --- | --- | --- | --- |
| trigger: offer accepted and agreement signed | create the account from the template | | HR: permissions |
| before day one | legal tasks with deadlines | check the manager and buddy are available on the start date; propose a replacement if not | manager: replacement |
| access | apply the position's template | find the access the first tasks actually need, missing from the template | owner of each access |
| first weeks | checklist reminders | chase blocked items, re-plan the order | |
| offboarding | final hours summary, retention per kind of data | find access left behind everywhere | HR and IT: every revocation |

EU AI Act line, all jobs: the agent routes, explains and prepares. A human approves anything that decides something about a person.

Questions for mentors in this step:
- which of these users do you see as a real paying customer?
- do you know any company that has this pain today, so we can ask them?
- does UiPath want its own stack integrated (Maestro, Action Center), or is OpenRouter enough?

## 3. How do we get into their day? (20 min)

Plug into habits they already have instead of asking them to install something new. Proposed answer, the team decides:

**Helper for their judgement, not a replacement.** The agent prepares and chases. HR, the manager and the access owner decide. It never approves access or picks a cover on its own: it proposes, they tap.

**Channel: Slack.** In a start-up, HR, managers, buddies and IT are already on Slack all day. The agent writes to each of them there, approvals included. No new tool to install. Before day one the new hire isn't on Slack yet, so they get emails from the company's Microsoft account.

**Linked to what they already do:**
- Microsoft organisation (Entra ID, through Microsoft Graph): sign-in with Microsoft SSO, the account and its groups, i.e. the permissions;
- Outlook Calendar (Graph): who is away on the start date, and when the first day happens;
- GitHub and GCP: the access the first tasks need, and the access left behind at offboarding;
- what HR uses today (a spreadsheet or an HR tool): the agent reads the start date and the position from there, it doesn't replace them.

A web page shows the run step by step, for whoever wants to follow it or correct a step. It's what the rubric's "follow progress, correct mistakes" needs, but people's day stays in Slack.

Where each person already is, during onboarding and offboarding:

| Who | Where they already work | What the agent does there |
| --- | --- | --- |
| HR (often the founder, in a small start-up) | Slack, Gmail, Calendar, the HR tool or spreadsheet they have today | gets an approval card, sees the run's progress, corrects a step |
| manager | Slack, Calendar | "you're away on Maria's first day: pick a cover" with one tap |
| buddy | Slack | is asked, accepts or declines; the agent looks for someone else if they decline |
| new hire | personal email before day one, Slack after | sees what is ready for them and who to ask |
| access owner (IT, CTO) | Slack, GitHub, GCP console | approves the access the first tasks need |

Channels to pick from:

| Channel | For | Against |
| --- | --- | --- |
| Slack bot | everyone above already lives there; approvals in one tap; the PRD already has a Slack bot | needs a Slack app per workspace |
| Google Workspace (Calendar, Gmail) | Workspace is mandatory in the PRD; availability on the start date comes from Calendar | email alone is slow for approvals |
| web app | a page for HR to follow the run and correct it: the "follow progress, correct mistakes" part of the rubric | it's one more place to open |


## 4. Business plan (15 min)

Pricing comes from the form answers (question 6), not from guesses. No answers yet, so the prices below stay empty until they arrive.

**Who pays:** the company (B2B). The founder or COO buys, HR runs it, everyone else uses it for free. Freemium for end users doesn't apply: the new hire and the manager never pay.

**Three models to choose from:**

| Model | How it works | For | Against |
| --- | --- | --- | --- |
| A. Included in Enterpreyes | part of the seat price in the PRD (30 USD seats 1-19, 25 USD from the 20th) | no new price; the agent is a reason to buy Enterpreyes | the hackathon product isn't a business of its own |
| B. Subscription per active employee | X EUR per employee per month, as an add-on or standalone | predictable revenue, the market is used to it (Factorial from 8 USD per user) | a start-up with 10 people and 2 hires a year pays for 10 months of nothing |
| C. Per run | Y EUR per onboarding or offboarding | the price follows the value: it's paid exactly when a hire happens; comparable to the cost per hire (~4,700 USD) | unpredictable revenue for us |

**Anchors the price has to sit between:**
- lower bound: what they pay today for onboarding in an HR suite (Factorial from 8 USD per user per month, a whole suite);
- upper bound: what one mistake costs them, at least 20,000 EUR for a hire lost in the first 90 days on a 40,000 EUR salary (Finance to check);
- the client's own cost: the LLM calls per run (OpenRouter now, Vertex AI in the PRD), measured on the first real runs, not estimated.

**What the form has to answer:**
- question 6, the price per employee per month;
- add: "How many people did you hire and how many left in the last 12 months?" Without it we can't compare B and C.

## Sources

- [Gallup: Perspective on creating an exceptional onboarding journey (PDF)](https://www.gallup.com/file/workplace/247076/Gallup_Perspective_on_Creating_an_Exceptional_Onboarding_Journey_for_Your_New_Employees.pdf)
- [Gallup: onboarding new employees](https://www.gallup.com/workplace/235121/onboarding-new-employees.aspx)
- [OneLogin 2017 survey, via BetaNews](https://betanews.com/2017/07/18/exemployees-access-corporate-apps)
- [One Identity on dormant accounts, via Identity Week](https://identityweek.net/one-identity-finds-that-dormant-accounts-pose-major-risk/)
- [SHRM: employers risk driving new hires away with poor onboarding](https://www.shrm.org/mena/topics-tools/news/talent-acquisition/employers-risk-driving-new-hires-away-poor-onboarding)
- [EmpTrust: the true cost of new hire turnover](https://www.emptrust.com/?p=22802)
- [HR Cloud: 1 in 3 new hires leave within 90 days](https://www.hrcloud.com/blog/new-hire-onboarding-software-guide)
- [IBM Cost of a Data Breach Report 2025 (PDF, via Baker Donelson)](https://www.bakerdonelson.com/webfiles/Publications/20250822_Cost-of-a-Data-Breach-Report-2025.pdf)
