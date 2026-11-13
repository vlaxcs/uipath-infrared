# UiPath hackathon: before and idea phase

Shared knowledge base for the team and the AIs. Playbook gate "Before" lives here; decisions and rejected ideas go in the log at the bottom.

## The brief

Build an agent that pursues a goal across multiple steps. Show why an agent and not:
- a regular program;
- a fixed workflow;
- a single LLM call;
- and show how the agent uses intermediate results to decide its next step.

Calling an LLM or chaining preset steps is not enough on its own.

Resources: OpenRouter credentials per team, any language or framework, UiPath products or open-source tools allowed. Mentors visit for check-ins.

## Rubric (100 points)

| Criterion | Points | What judges look for | Where we win it |
| --- | --- | --- | --- |
| Working result | 30 | a complete task runs from input to an inspectable outcome | one flow, real GCP and GitHub, a run log you can open |
| User value | 25 | a clear user and a compelling use case, shown in the demo | a named person with a named pain from the PRD |
| Agent design | 20 | useful decisions; handles change, missing information, failed actions | branches driven by what each tool call returned |
| Originality | 15 | a distinctive idea or approach, substantive team contribution | built on our own PRD and infra modules, not a template |
| Usability and control | 10 | follow progress, correct mistakes, approve important actions | live step timeline, approve or edit before every write |

## UiPath profile (to verify with mentors)

- Sells enterprise automation: RPA robots, and since 2025 an agentic automation platform.
- Maestro: orchestration of agents, robots and people. Agent Builder: visual canvas to build and debug agents. Human-in-the-loop through Action Center.
- 2026: Maestro Connector on Salesforce AgentExchange (April); community reports of Maestro Flow (August), where coding agents design governed processes, and of UiPath Delegate at FUSION 2026. Not confirmed from official release notes.
- What they care about publicly: agents that are governed, auditable and keep a human in control of risky actions. That is the "Usability and control" line of the rubric, and it is what Enterpreyes already promises.

## Source PRD

`V:\enterpreyes\docs\prd.md` (approved). Full product: 24 services, self-hosted in the client's GCP. The hackathon builds one agentic slice of it as an MVP.

## Team

| Who | Owns |
| --- | --- |
| Vlad | PM / Scrum master + polisher; repo setup; the agentic flow end to end; Slack keys |
| Miruna | branding: palette, mascot, logo |
| Andrei | the mocked systems; the Slack bot |
| Robi | the phone frame: everything the employee receives |
| Remus | the platform UI, once Vlad has set up the repo |

Playbook roles not assigned yet: speaker (pitch, live demo), finance (pricing, business plan, numbers in the pitch).

## Skills map

CVs go in `docs/hackathon/cvs/`. Add here what each CV misses.

| Who | Skills the CV misses |
| --- | --- |
| | |

## Tools

| Need | Tool | Who uses it |
| --- | --- | --- |
| shared notes | | |
| design | Figma | |
| 3D models (mascot, video) | `/brag` skill on Meshy | |
| 3D models, free | 3D MCP (name to fill in) | |
| animation (mascot, video) | Rive, in the editor directly if there's no MCP | |
| sound effects (video) | library of 74 sounds | |
| repo | GitHub | |
| AI for code | | |
| AI for research and copy | | |
| AI for voiceover | | |
| LLM inside the agent | OpenRouter (team credentials) | |

## Gate: Before

- [x] rubric in hand
- [ ] company profile confirmed with a mentor
- [ ] roles assigned
- [ ] skills map filled
- [ ] tools picked, all of this in one shared place

## Decision log

| Time | Decision or rejected idea | Reason |
| --- | --- | --- |
| Before | Skip `/grill-with-docs` for this hackathon; the dev SPEC is grilled inline instead | Vlad's call for this session |
| Idea 1 | Target: start-ups and small enterprises; the agent improves employee experience and HR efficiency | team decision; mentors not yet consulted |
| Idea 1 | Rejected as the main job: worked hours math (C) | a regular program, fails the agent filter |
| Idea 1 | Job: the employee lifecycle, onboarding to offboarding (H2 + H3); the MVP workflows are cut to fit the deadline | team decision |
| Idea 2 | Onboarding is internal and starts when the offer is accepted and the agreement signed; recruiting, offer and signing are out of scope | team decision |
| Idea 3 | Channel: Slack approvals (Bolt, Socket Mode), the same approvals as buttons on the run's web page as a fallback; new hire gets Workspace emails before day one | Slack is where start-ups already work; the page keeps the demo alive if Slack or Wi-Fi drops |
| Idea 3 | Rejected for the MVP: Slack Q&A bot, Slack-to-account linking by email, judges joining the workspace | out of the demo path, or too slow on stage |
| Idea 3 | Identity and permissions: a Microsoft organisation (Entra ID, Microsoft SSO), through Microsoft Graph | the hackathon PRD is its own MVP; the Enterpreyes PRD's constraints don't bind it |
| Idea 5 | Onboarding starts at the offer, replacing "offer accepted and agreement signed" | Vlad |
| Idea 5 | One agentic workflow from the offer to offboarding, with the Enterpreyes flows in between; most data mocked, mocked data still drives decisions | Vlad |
| Idea 5 | Flows in between: focus on contract amendments and performance reviews; moves between projects and departments useful; leave nice to have | amendments and reviews are the least automated today |
| Idea 5 | Rejected: worked hours | doesn't really matter for this product |
| Idea 5 | Rejected: access requests | Vlad's call |
| Idea 5 | Workflow: one case per person, replanned on every event, a simulated clock for the demo; timeline from offer to offboarding in `01-idea.md` | built on the UiPath People Ops interview |
| Idea 5 | Demo path: offer to day 1 with 3 live disruptions (manager away, Windows-only team, no clinic slot), then jump to probation, review, offboarding | each disruption is a decision from an intermediate result |
| Idea 5 | Two surfaces: a phone demo of what the employee receives (email, Slack bot setup), and a platform with locked modules, an "Awaiting onboarding" panel and a state graph per person | Vlad |
| Idea 6 | Name: Wellboarder | Vlad |
| Idea 5 | Real, not simulated: the Slack bot, the new hire's Microsoft account and email, Microsoft SSO sign-in; replaces "simulated in the phone frame" | Vlad |
| Idea 5 | Occupational medicine at Regina Maria moves to the trainings: slots proposed by email, the slot read from the reply, then booked | Vlad |
| Idea 5 | On-prem as an option, with hidden costs (lab setup, cooling, disk replacement, risks); we choose the sources; several analyses per run, the CTO (client) picks which carry into later plans | jury feedback |
| Pivot | Wellboarder rejected; playbook restarts from step 1 with a new problem: re-plan a company's cloud infrastructure across providers from the roadmap and financial forecast | mentor: every company grants access through different providers and services, so onboarding is hard to generalise across companies |
| Idea gate | A second mentor: the onboarding idea is fairly common | originality at risk (15 points); direction to decide |
| Idea gate | Mentors validated the idea; the validation form is out, answers pending | Vlad |
| Idea 1 | Rejected as separate jobs: H1 (Slack requests) and H4 (ask HR anything) | H1 can come back as the channel, H4 is a single LLM call with RAG |
