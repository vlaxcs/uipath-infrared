# Idea phase -> one-page PRD

Decisions only. Rejected ideas and their reasons live in the decision log in `00-before.md`.

| Step | Status |
| --- | --- |
| 1. Who do we target? | done, mentors to confirm |
| 2. What is their problem? | done, waits for form answers |
| 3. How do we get into their day? | done |
| 4. Business plan | open: pricing model, waits for form answers |
| 5. Design the product | drafted, mentors to validate |
| 6. Branding | in parallel, designer |

## 1. Target

- **Buyer:** founder or COO of a start-up or small enterprise.
- **Users:** HR (often the founder), managers, buddies, access owners, and the new hire or the leaver.
- **Job:** the employee lifecycle, from onboarding to offboarding, done by an agent.
- **Onboarding** is internal and starts when the offer is accepted and the agreement signed. Recruiting, the offer and the signing are outside the product.

## 2. Problem

1. **The same onboarding goes differently every time.** The manager is away on day one, the buddy isn't delegated in time, the access the job needs is wrong, and nobody finds out until the new hire is blocked.
2. **HR mixes fixed steps with steps that need judgement.** Fixed: create the account, legal deadlines. Judgement: who covers for the absent manager, which access is actually missing. In a start-up one person holds both in their head.
3. **Offboarding leaves access behind.**

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
- **Channel:** Slack approvals (Bolt, Socket Mode). The same approvals as buttons on the run's web page, as a fallback and for following the run.
- **New hire before day one:** emails from the company's Microsoft account.
- **Linked to:** the Microsoft organisation (Entra ID SSO, groups as permissions, Outlook Calendar, through Microsoft Graph), GitHub and GCP for access, and whatever HR uses today for the start date and position.

## 4. Business plan

- **B2B:** the company pays; the new hire and the manager never do.
- **Open:** subscription per employee per month, or a price per onboarding and offboarding. Decided from form answers 6-8.
- **Anchors:** floor, an HR suite (Factorial from 8 USD per user per month); ceiling, the cost of one lost hire; our cost, LLM calls per run, measured on real runs.

## 5. Product design

**Next to what already exists.** We don't replace the HR tool, Entra ID or Slack. The agent sits next to them and runs the lifecycle across them. The market is proven: HR suites already sell onboarding and offboarding checklists (Factorial, Personio, Rippling), so companies already pay for this job. What they don't do is replan when something goes wrong.

**The product, split by type:**

| Stage | Fixed rule (workflow) | The agent decides | A person approves |
| --- | --- | --- | --- |
| trigger: offer accepted, agreement signed | create the Entra ID account | | |
| before day one | legal tasks with deadlines | is the manager free on the start date? is the buddy confirmed? if not, propose a replacement | manager picks the replacement |
| access | add to the position's groups | which access the first tasks need that the groups don't give | the owner of each access |
| first weeks | checklist reminders | what is blocked, and in what order to unblock it | |
| offboarding | final summary | where access was left behind (Entra ID, GitHub, GCP) | HR and IT, every revocation |

MVP cut: open, see the questions below.

**Legal check, and what we adjusted:**

| Risk | Adjustment |
| --- | --- |
| EU AI Act, Annex III: AI that allocates work or makes decisions about workers is high-risk | the agent proposes, a person decides; replacements are proposed by calendar availability only, never by behaviour, performance or personal traits |
| reading calendars is employee monitoring (in Romania, Law 190/2018 art. 5) | read free/busy for the start date only (Graph `getSchedule`), never event titles or contents |
| GDPR: the new hire's personal data sent to an LLM through OpenRouter, possibly outside the EU | the LLM sees IDs and roles, not names, addresses or IBANs; the app maps them back |
| GDPR: keeping a leaver's data | offboarding deletes or anonymises what is no longer needed, and logs it |
| access revoked by mistake | no revocation without a person's approval; every action logged |

None of this is legal advice. A mentor or a lawyer confirms the AI Act line.

## Open questions

- How does the system learn the agreement was signed?
- Who on the team is an admin in the Microsoft tenant, for Graph admin consent?
- MVP cut: which stages go on the demo path? The whole lifecycle, or onboarding plus one offboarding?
- Mentors, before any code:
  - does an SME buyer hurt "user value" with UiPath judges?
  - do they want UiPath's stack (Maestro, Action Center), or is OpenRouter enough?
  - is "propose a replacement by availability, a person decides" outside the AI Act's high-risk category?
  - is the full idea, as written in this page, a yes?

## Sources

- [Gallup: exceptional onboarding journey (PDF)](https://www.gallup.com/file/workplace/247076/Gallup_Perspective_on_Creating_an_Exceptional_Onboarding_Journey_for_Your_New_Employees.pdf)
- [SHRM: poor onboarding drives new hires away](https://www.shrm.org/mena/topics-tools/news/talent-acquisition/employers-risk-driving-new-hires-away-poor-onboarding)
- [One Identity on dormant accounts, via Identity Week](https://identityweek.net/one-identity-finds-that-dormant-accounts-pose-major-risk/)
- [IBM Cost of a Data Breach 2025 (PDF)](https://www.bakerdonelson.com/webfiles/Publications/20250822_Cost-of-a-Data-Breach-Report-2025.pdf)
