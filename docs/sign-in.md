# Sign-in with GitHub

Slice 4 of `docs/platform.md` section 9: people sign in to the dashboard with GitHub, the orchestrator keeps users and sessions in Postgres, and every API route needs a session or the service token. The Chrome extension's own token (`docs/chrome-extension.md` section 3) builds on this and is not part of it.

No grill ran on this spec; section 10 lists the defaults taken in its place.

## 1. Use cases

1. A person opens the dashboard without a session; it opens `#/login`.
2. They press **Sign in with GitHub**. The login page shows a code and a link to `github.com/login/device`; they enter the code there and approve the Infrared GitHub App. The dashboard notices on its own and opens home, signed in, with their avatar and credits in the frame.
3. A returning person with a live session opens the dashboard straight on the page they asked for.
4. They choose **Disconnect** in the avatar menu; the session ends on the server and the dashboard opens `#/login`.
5. The Slack bot reads runs and posts decisions with the service token.
6. A developer runs the orchestrator locally without the GitHub App, with `ORCHESTRATOR_AUTH=off`, and everything works as before this change.

## 2. The GitHub side

- Sign-in uses the Infrared GitHub App's user authorization: its client id and secret. There is no separate OAuth app; `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` in `docs/platform.md` section 8 are replaced by `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`.
- The App's callback URL is `<orchestrator>/auth/github/callback`. The authorize request sends no `redirect_uri`, so GitHub uses the registered one.
- The orchestrator exchanges the code for a user token, reads `GET https://api.github.com/user` once for `id`, `login` and `avatar_url`, and drops the token. It never stores a GitHub token.
- A person is identified by their GitHub numeric `id`, never by `login`: logins can be renamed and reused.

## 3. Routes

The dashboard signs in with GitHub's device flow: no callback, so it works whatever runs on the orchestrator's port and from any host. The redirect routes stay for a hosted deployment with a registered callback. The device flow needs **Enable Device Flow** ticked in the GitHub App's settings.

| Route | Does |
| --- | --- |
| `POST /auth/device` | asks GitHub for a device code; keeps the `device_code` in an `HttpOnly` cookie and answers `{user_code, verification_uri, expires_in, interval}`. `502` when GitHub refuses (device flow off) |
| `POST /auth/device/poll` | asks GitHub once whether the code was approved. `{status}`: `pending`, `slow_down` (wait 5 s longer), `expired`, `denied`, `no_cookie` (the browser did not send the device cookie back), or `signed_in` with the session cookie set. `502` when GitHub fails, `503` when the database does |

The dashboard polls every `interval` seconds, adds 5 on `slow_down`, and stops at `expires_in`. The `device_code` never reaches JavaScript: whoever holds it can finish the sign-in.


| Route | Does |
| --- | --- |
| `GET /auth/github` | sets a random `state` in a short cookie and redirects to GitHub's authorize page with it |
| `GET /auth/github/callback` | checks `state` against the cookie, exchanges the code, upserts the user, opens a session, sets the session cookie, redirects to the dashboard |
| `POST /auth/logout` | deletes the session, clears the cookie, `204`. Without a session, still `204` |
| `GET /me` | `200`, `{login, avatar_url, credits, plan}` of the session's user. `401` without one. With the service token: `403`, the service has no user |

Every other route answers `401` without a session cookie or `Authorization: Bearer <ORCHESTRATOR_SERVICE_TOKEN>`. CORS preflights are answered before authentication.

Callback success redirects to `<ORCHESTRATOR_DASHBOARD_URL>/#/`. Failures redirect to `<ORCHESTRATOR_DASHBOARD_URL>/?login_error=<code>#/login` instead of showing an orchestrator page; the code sits in the query, not the hash, so the dashboard's hash routes stay as they are:

| Code | When |
| --- | --- |
| `state` | no state cookie, or it does not match |
| `denied` | GitHub sent `error=access_denied` |
| `github` | no `code`, or the code exchange or `GET /user` failed |
| `unavailable` | the database failed while opening the session |

## 4. Cookies

| Cookie | Value | Attributes |
| --- | --- | --- |
| `infrared_session` | 32 random bytes, base64url | `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` when `ORCHESTRATOR_DASHBOARD_URL` is `https://`, `Max-Age` 30 days |
| `infrared_device` | GitHub's `device_code` | `HttpOnly`, `SameSite=Strict`, `Path=/auth/device`, `Secure` as above, `Max-Age` GitHub's `expires_in`, cleared on `signed_in`, `expired` and `denied` |
| `infrared_oauth_state` | 32 random bytes, base64url | `HttpOnly`, `SameSite=Lax` (it must survive the redirect back from github.com), `Path=/auth/github`, `Secure` as above, `Max-Age` 10 minutes, cleared on callback |

- The database keeps the SHA-256 of the session token, never the token. The token has 256 bits of entropy, so a plain hash is enough and no server secret is needed; `SESSION_SECRET` is dropped.
- `SameSite=Strict` needs the dashboard and the orchestrator on the same site. Locally that means the same host: `http://127.0.0.1:5173` and `http://127.0.0.1:8080`, not `localhost` for one and `127.0.0.1` for the other. A dashboard opened on the other loopback name moves itself to the orchestrator's host before it renders.
- CORS sends `Access-Control-Allow-Credentials: true` to the allowed origins and allows the `Authorization` header. The dashboard's requests send `credentials: "include"`.

## 5. Data

Postgres 17, its own database, `ORCHESTRATOR_DATABASE_URL`. Locally a separate `app-db` service in `docker-compose.yml` on `127.0.0.1:54330`, not the sites database: users and sessions cannot be recreated, sites can.

```sql
CREATE TABLE users (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  github_id   bigint NOT NULL UNIQUE,
  login       text NOT NULL,
  avatar_url  text NOT NULL,
  credits     integer NOT NULL DEFAULT 5 CHECK (credits >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash  bytea PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_id ON sessions (user_id);
CREATE INDEX sessions_expires_at ON sessions (expires_at);
```

- Every authenticated request costs one query: the session joined to its user, on the primary key, filtered on `expires_at > now()`.
- Sign-in costs one upsert on `github_id` and one insert into `sessions`, in one transaction.
- Expired sessions are deleted every hour in one statement on the `expires_at` index.
- The orchestrator applies its migrations at startup, from SQL files embedded in the binary, under a Postgres advisory lock so two instances never migrate at once. Applied versions live in `schema_migrations`.
- `plan` is `run_pack` for everyone until Stripe (slice 6).

## 6. Startup

| `ORCHESTRATOR_AUTH` | Needs | Otherwise |
| --- | --- | --- |
| unset or `on` | `ORCHESTRATOR_DATABASE_URL`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `ORCHESTRATOR_SERVICE_TOKEN` (at least 32 characters), `ORCHESTRATOR_DASHBOARD_URL` | stops, naming every missing variable |
| `off` | `ORCHESTRATOR_ADDR` on a loopback address | stops: auth can only be off on loopback |

With auth `off` nothing changes from today: no database, no `/auth` routes, `/me` answers `404`.

## 7. Clients

- Dashboard: `credentials: "include"` on every orchestrator request; a `401` from any of them opens `#/login`. The login page shows the callback's `login_error` in words. **Disconnect** posts `/auth/logout` and opens `#/login` without waiting for the answer. Vite listens on `127.0.0.1` so the dashboard and the orchestrator share a site.
- Slack bot: sends `Authorization: Bearer $ORCHESTRATOR_SERVICE_TOKEN` when it is set.
- Chrome extension: unchanged here. Against an orchestrator with auth on it gets `401` and shows its sample data; its own token is `docs/chrome-extension.md` section 3.

## 8. Failure modes

| Failure | What happens |
| --- | --- |
| Postgres down at startup | the orchestrator stops with the reason |
| Postgres down while serving | authenticated routes answer `503`; nothing is let through |
| GitHub down during sign-in | back to login with `login_error=github` |
| Postgres down during sign-in | back to login with `login_error=unavailable` |
| State cookie missing (cookies blocked, took over 10 minutes) | back to login with `login_error=state` |
| Session expired or deleted | `401`; the dashboard opens `#/login` |
| A user renamed their GitHub login | the upsert on `github_id` updates `login` and `avatar_url` at the next sign-in |
| Wrong or short service token | `401`, the same answer as no token |
| Two instances start at once | the advisory lock orders their migrations |

## 9. Load

- One indexed query per authenticated request. Every Slack bot poll and dashboard poll pays it; at a thousand times today's traffic this is the first thing the database sees, so its plan is measured with `EXPLAIN (ANALYZE, BUFFERS)` before the PR opens.
- `sessions` grows with sign-ins, not requests; the hourly sweep bounds it to 30 days of sign-ins.
- The connection pool is `pgxpool` with its defaults; no per-request connection.

## 10. Decisions taken without the grill

Each one is a recommended default. Overturn any of them and this file changes first.

1. Non-browser clients use one service token; browsers use the session cookie; every route accepts either (Vlad's).
2. Auth is on unless `ORCHESTRATOR_AUTH=off`, and off only on loopback (Vlad's).
3. Postgres for users and sessions (Vlad's).
4. Server-side sessions, 30 days, hashed tokens; no `SESSION_SECRET`.
5. New users start with 5 credits, as the dashboard's sample account shows today.
9. `.env.example` ships `ORCHESTRATOR_AUTH=off`, so a fresh copy keeps working on loopback; a real deployment sets it on or leaves it unset.
6. The GitHub user token is dropped after reading the profile.
7. A separate `app-db` service locally.
8. Migrations embedded and applied at startup under an advisory lock.
10. The dashboard signs in with the device flow (Vlad's); the redirect flow stays on the server.

## 11. Out of scope

- The Chrome extension's token.
- Listing the user's GitHub App installations; the extension spec needs it.
- Credits being spent, Stripe (slice 6).
- Teams, more than one user per account, roles.
- Signing out every session of a user.
- Rate limiting the auth routes.
