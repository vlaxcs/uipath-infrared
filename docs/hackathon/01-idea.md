# Idea phase -> one-page PRD

Decisions only. Rejected ideas and their reasons live in the decision log in `00-before.md`.

| Step | Status |
| --- | --- |
| 1. Who do we target? | done, mentors validated |
| 2. What is their problem? | done, validated with UiPath People Ops; form out, answers pending |
| 3. How do we get into their day? | done |
| 4. Business plan | open: pricing model, waits for form answers |
| 5. Design the product | done, mentors validated; legal parked |
| 6. Branding | name and direction done; designer delivers palette, mascot, logo |

## 1. Target

- **Buyer:** founder or COO of a start-up or small enterprise.
- **Users:** HR (often the founder), managers, buddies, access owners, and the new hire or the leaver.
- **Job:** the employee lifecycle, from onboarding to offboarding, done by an agent.
- **Starts at the offer.** Offer to day 0 is **pre-onboarding**, day 1 onward is **onboarding** (People Ops' own words). Recruiting before the offer is outside the product.

## 2. Problem

1. **The same onboarding goes differently every time.** The manager is away on day one, the buddy isn't delegated in time, the access the job needs is wrong, and nobody finds out until the new hire is blocked.
2. **HR mixes fixed steps with steps that need judgement.** Fixed: create the account, legal deadlines. Judgement: who covers for the absent manager, which access is actually missing. In a start-up one person holds both in their head.
3. **Offboarding leaves access behind.**

**Validated** in an interview with UiPath People Ops ([notes](interviews/01-uipath-people-ops.md)): paperwork is automated, but occupational medicine, the IT and reception heads-up, hardware, review requests and review meetings are manual, and the same experience across offices is their biggest onboarding challenge.

**Why an agent:** fixed steps run as a workflow; the agent gets only the steps whose path depends on what it finds, and a human approves anything that decides something about a person.

**What it costs:**
- only 12% of employees strongly agree their company onboards well; with an involved manager, onboarding is 3.4x more likely to succeed (Gallup);
- replacing someone costs 50-200% of their salary (attributed to SHRM, original to find); a hire lost in the first 90 days on 40,000 EUR is at least 20,000 EUR (Finance to check);
- 70% of companies aren't confident former employees' accounts are closed in time (One Identity); a malicious insider breach averages 4.92M USD (IBM 2025);
- GDPR fines up to 20M EUR or 4% of turnover.

**Validation form** (Discord, LinkedIn, mentors):
1. How many people work at your company, and who does HR?
2. At the last hire, what wasn't ready on day one?
3. How many days until the new person did real work?
4. At the last departure, how sure are you every access was removed?
5. What do you use today for onboarding and offboarding?
6. How much would you pay per employee per month? (0, 1-3, 3-5, 5-10, 10+ EUR)
7. How many people did you hire, and how many left, in the last 12 months?
8. Per employee per month, or per hire and per departure?

## 3. Getting into their day

- **A helper, not a replacement:** the agent prepares and chases; people decide with one tap.
- **Channel:** a real Slack bot for approvals and messages. The same approvals as buttons on the run's web page, as a fallback and for following the run.
- **New hire before day one:** emails from the company's Microsoft account.
- **Linked to:** the Microsoft organisation (Entra ID SSO, groups as permissions, Outlook Calendar, through Microsoft Graph), GitHub and GCP for access, and whatever HR uses today for the start date and position.

## 4. Business plan

- **B2B:** the company pays; the new hire and the manager never do.
- **Open:** subscription per employee per month, or a price per onboarding and offboarding. Decided from form answers 6-8.
- **Anchors:** floor, an HR suite (Factorial from 8 USD per user per month); ceiling, the cost of one lost hire; our cost, LLM calls per run, measured on real runs.

## 5. Product design

- **One agentic workflow** that covers the whole lifecycle: from the offer, through onboarding, the Enterpreyes flows in between, to offboarding.
- **It doesn't have to sit next to an existing product.**
- **Flows in between:**
  - focus: contract amendments and performance reviews, the least automated today;
  - useful: moving between projects and departments;
  - nice to have: leave requests;
  - left out: worked hours, access requests.
- **Mocked for the MVP:** most data, such as the employees' schedule. The mocked data still drives the agent's decisions, e.g. the schedule tells it whether the manager is in the office.

### How it works: one case per person, replanned on every event

Every person gets a **case** with a goal: productive and welcomed on day X. The agent wakes on events (contract signed, form filled in, schedule changed, a deadline coming up), reads the state, sees what changed and replans. Every decision is logged with its reason, so a run can be replayed step by step.

A **simulated clock** compresses weeks into minutes, so the demo moves time forward and the agent reacts live.

### The timeline

*Italic* = manual at UiPath today, from the interview. **The agent decides** = a step whose path depends on what it finds.

**Pre-onboarding (offer to day 0)**
- **Offer accepted:** the person lands in the HRIS (Workday at UiPath, mocked). The case opens.
- **Contract** goes to signing (DocuSign, mocked). Not signed in X days: the agent nudges the recruiter.
- **Hardware**, after signing: the person picks Mac or Windows in a form. **The agent decides:** Mac wanted but the team requires Windows, it explains to the person and tells IT; Mac out of stock, it proposes an alternative, IT approves. *Manual today.*
- **Who receives them on day 1:** **the agent decides** from the schedule. Manager in that office that day? If not, a buddy or a colleague from the same office. Nobody there (e.g. a coworking space): it proposes a remote first day or another date, the manager decides. *Their biggest challenge: the same experience across offices.*
- **D-2:** the manager gets a Slack message with what to prepare.
- **D-1:** the agent posts to the IT and reception channel: "X starts tomorrow at 10, Y receives them". *Manual today.*
- **Accounts:** Microsoft SSO, GitHub by team. A security team also gets a YubiKey task.

**Onboarding (day 1 onward)**
- **Day 1:** welcome and the first day's plan.
- **Day 2:** mandatory trainings. The agent tracks completion, nudges, and escalates to the manager at the deadline.
- **Occupational medicine at Regina Maria**, part of the trainings: **the agent decides** which free slots to offer, emails them to the person, reads the slot they pick from their reply, and books the appointment. *Manual today, "in every company".*
- **Check-ins, week 1 and month 1:** **the agent decides** a slot both calendars have free. Manager goes on leave: it reschedules.
- **Probation:** 2 weeks before it ends, the manager gets "probation ends, do you confirm?". The agent gathers the check-in notes; the manager decides. *Suggested by People Ops.*

**In between**
- **Performance review:** **the agent decides** who to ask for feedback from shared projects, and the template ("one project" or "the whole year"); the manager confirms. It chases the forms and books the face-to-face discussion. *All manual today, and they want it automated.*
- **Contract amendment:** a salary or position change creates the amendment from a template, routes the approvals, sends it to signing, updates the HRIS.
- **Move to another team:** the new manager accepts, a buddy in the new team, accounts by team. **The agent decides:** the new team requires Windows, the laptop is swapped; the department changes, an amendment follows.
- **Leave:** nice to have.

**Offboarding**
- The last day sets the plan: hardware and YubiKey back, a knowledge handover, the exit interview, the account closed on the last day.
- **The agent decides** what SSO doesn't cut: GitHub org membership, tools outside SSO. *People Ops believes closing the account cuts everything; this is the gap.*

### Two surfaces

- **Phone, the employee's view:** everything the new hire receives during onboarding: the emails, setting up the Slack bot, and the rest of what reaches them. Shown in a phone frame on the laptop, not on a real phone. Real: the Slack bot, the Microsoft account with its email, and SSO sign-in, created by the agent.
- **Platform, HR and the manager's view:**
  - a side panel with most modules of the previous internal platform (Dashboard, Team Schedule, Tasks, Projects, Performance Review, Org Chart, Employees, Contracts, Leave and the rest), shown but locked;
  - an **Awaiting onboarding** panel listing the people in onboarding;
  - for each person, their case as a graph of states: where they are, how they got there, what's next.

### The demo path

One person, offer to day 1, with 3 disruptions injected live: the manager isn't in the office, the team requires Windows, no clinic slot in time. Then the clock jumps to probation, a review and offboarding. Each disruption is a decision the agent takes from an intermediate result.

- **Legal check:** parked. Ask a mentor, starting with performance reviews (EU AI Act, Annex III: AI that evaluates workers is high-risk).

## 6. Branding

- **Name:** Wellboarder.
- **Palette:** from scratch, not from the friendeyes theme. Leads with warmth and welcome. The designer proposes the colours.
- **Mascot and logo:** the designer picks the mascot; the logo is built around it.

## Open questions

- Microsoft tenant admin for Graph admin consent: Vlad.
- Mentors: does an SME buyer hurt "user value" with UiPath judges? Do they want UiPath's stack (Maestro, Action Center) or is OpenRouter enough?

## Sources

- [Gallup: exceptional onboarding journey (PDF)](https://www.gallup.com/file/workplace/247076/Gallup_Perspective_on_Creating_an_Exceptional_Onboarding_Journey_for_Your_New_Employees.pdf)
- [SHRM: poor onboarding drives new hires away](https://www.shrm.org/mena/topics-tools/news/talent-acquisition/employers-risk-driving-new-hires-away-poor-onboarding)
- [One Identity on dormant accounts, via Identity Week](https://identityweek.net/one-identity-finds-that-dormant-accounts-pose-major-risk/)
- [IBM Cost of a Data Breach 2025 (PDF)](https://www.bakerdonelson.com/webfiles/Publications/20250822_Cost-of-a-Data-Breach-Report-2025.pdf)
