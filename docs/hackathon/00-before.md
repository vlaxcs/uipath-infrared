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

| Role | Owns during the event | Who |
| --- | --- | --- |
| PM / Scrum master + polisher | scribe, scope, timeboxes, gate checks, UI polish | Vlad |
| Speaker | mentor conversations, pitch, live demo | |
| Designer / marketer | branding, UI/UX, assets, pitch site, video | |
| Full-stack | tech stack, repo, core features, deploy | |
| Finance | market size, pricing, business plan, numbers in the pitch | |

Team: Miruna, Robi, Andrei, Remus, Vlad. The remaining roles get assigned from the CVs.

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
