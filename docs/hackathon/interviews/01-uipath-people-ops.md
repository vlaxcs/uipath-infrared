# Interview 1: UiPath People Ops

Mentor from UiPath's People Ops, during the hackathon, 2026-11-13. Notes, not a transcript.

## Their onboarding today

| Step | How it runs | Automated? |
| --- | --- | --- |
| hire | recruiting presses a button, the person is added to Workday | yes |
| paperwork | People Ops fills templates from the person's data; robots generate the documents | yes, in the happy case; People Ops mostly tracks the process |
| contract signing | DocuSign, with an ID and CNP check (not a qualified certificate) | yes |
| occupational medicine appointment | scheduled by hand | no, "probably manual in every company" |
| heads-up to IT and reception | a message in a shared channel: "X starts tomorrow at 10, send them to IT" | no |
| hardware | after signing, a form for Mac or Windows; some teams require Windows; IT reads the department and prepares laptops by hand | no |
| accounts | email, GitHub, Wi-Fi, all through Microsoft SSO; the security team also gets a YubiKey on day 1, configured by the person on their SSO account | partly |
| manager reminder | an internal app sends the manager a Slack message 2 days before: prepare, and be in the office that day | yes |
| welcome | once the person has email and Slack, the same app sends a welcome and a first-day plan | yes |
| mandatory trainings | access on day 2, a must for everyone | yes |
| intranet onboarding pages | encouraged, not tracked | no |

## Their biggest onboarding challenge

The same experience for everyone, with offices in the US, across Europe and in India. People start in an office where nobody from their team works; some work from coworking spaces (e.g. Sibiu). About 750 people in Bucharest, ~1,000 in Romania.

## Ideas they gave us

- **Pre-onboarding** is everything before the contract day; onboarding starts on the contract day.
- Use the internal schedule to find who can receive the person on day 1: manager, buddy, someone else.
- Check-ins with the new person, and the first performance check-in.
- Notify the manager before probation ends: "do you confirm?".
- Hiring volume changes the need: 1-2 people a quarter is not mass hiring.

## Performance reviews

- Self-review: they already have an agent that summarises the feedback a person received during the year, including public Slack channels.
- Manager side: manual. The manager writes the review, requests feedback by hand and picks the template: "worked on one project" or "worked together all year".
- The face-to-face discussion is scheduled by the manager, by hand. They want it automated.

## Offboarding

Access is revoked by closing the account, which they believe cuts everything. Not verified.

## Hours

Only client-facing B2B teams fill a timesheet, for invoicing. Nobody else tracks hours.

## Their take

They like the idea, and onboarding is a priority area they're working on themselves. No objection to us building it; it fits start-ups and companies with a single office too. Available until midnight and tomorrow morning.
