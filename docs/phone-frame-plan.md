# Phone frame: plan

Task 1 in `docs/team/robi.md`: an iPhone screen on the laptop with a browser logged into Slack, next to the dashboard. Handover to Vlad at `H+4`.

## Approach

Slack refuses to load inside an iframe, so a web page alone cannot show it. `apps/phone/` becomes a small Electron app:

- The existing React `PhoneFrame` is the window's content. The window is frameless and transparent, so only the phone shows on the desktop.
- Slack runs in an Electron `<webview>` inside the frame's screen area, clipped by the rounded corners.
- The view uses a persistent session: log into Slack once, and it survives restarts.
- In a plain browser (`npm run dev`) the frame shows a placeholder instead, so the tests and the CI build do not need Electron.

## Layout in `apps/phone/`

```
electron/
  main.ts          entry point: reads settings, starts the app
  window.ts        the frameless, transparent phone window
  guard.ts         keeps the Slack view without Node access and applies the navigation rules
  navigation.ts    which addresses stay in the phone and which open in the browser
  settings.ts      reads the environment, stops naming a missing variable
src/
  phone/PhoneFrame.tsx     the frame
  slack/SlackScreen.tsx    the Slack view, or a placeholder in a browser
  slack/host.ts            tells the page whether it runs inside the Electron window
  App.tsx                  puts SlackScreen inside PhoneFrame
```

The Electron window passes the Slack address to the page in the query string; the page shows the Slack view only when it is there.

## Steps

| # | Step | Done when |
|---|---|---|
| 1 | Spike: a bare Electron window at phone width on Slack | we know whether Slack is usable at 396px or needs to render wider and zoomed out |
| 2 | Electron shell: `npm run phone` | the frame opens as a frameless desktop window |
| 3 | Settings: `SLACK_WORKSPACE_URL` from the root `.env` | the app stops at startup naming the variable when it is missing |
| 4 | Slack in the screen, with a persistent login | you log in once and the approval channel shows in the frame |
| 5 | Lock-down: no Node access in the Slack view, navigation limited to Slack and its sign-in providers, other links open in the normal browser | a link to another site opens outside the frame |
| 6 | Window behaviour: the bezel drags the window, it stays on top | it sits beside the dashboard without getting buried |
| 7 | CI and pull request | typecheck, tests and build are green; the PR lists the manual checks |

## Risks

- **Slack at phone width.** Slack's web client is built for desktop, and with a mobile user agent it sends you to the app store. The fallback is rendering it wider and zooming the view out. Step 1 settles this.
- **CI installs Electron.** `npm ci` downloads the Electron binary on the Linux runner. If that hurts the job, the web job skips the download with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`.
- **A new environment variable.** `SLACK_WORKSPACE_URL` goes in `.env.example` and in the table in spec section 4; Vlad reviews it.

## Tests

- Settings: a missing workspace URL stops startup and names the variable.
- Navigation: Slack addresses are allowed, others are not.
- Frame: shows the Slack view when the Electron window hosts it and the placeholder in a browser.
- The existing frame tests stay.

The Slack view itself is checked by hand: log in, open the approval channel, click a button in a message.
