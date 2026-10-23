---
type: observability-audit
date: 2026-10-23 18:58
mode: audit
commit: d417ccf
branch: m3l4-e2e
dirty_tree: true # only .claude/ skill files and CLAUDE.md (10x-cli sync); src/ untouched
areas: [log-workout-dashboard, auth-session]
area_source: foundation
runtime_proof: observed
error_tracker: none (Cloudflare Workers Logs only, wrangler.jsonc:13)
previous_report: null
findings: { critical: 2, high: 4, medium: 8, low: 9 }
---

# Observability audit — log-workout + dashboard, auth/session (2026-10-23)

## 1. TL;DR

- **A Supabase outage looks like everyone logged out, and leaves no log line.** `src/middleware.ts:10-13` drops the `error` from `auth.getUser()`, so every failure becomes `user = null` → `302 /auth/signin`. Proven at runtime (P12a/c): 302, outcome `ok`, **0 log lines**. A workout submitted during the outage is lost.
- **Every failure in the app ends as a 302 or a 200.** Sign-in/sign-up errors (outage, rate limit, wrong password) all become `302 ?error=<raw provider message>` with no log (`signin.ts:16`, `signup.ts:16`). Failed workout inserts become `302 ?error=…` (`api/workouts.ts:44`). Dashboard read failures become a 200 page with an alert (`dashboard.astro:19-24`). Status codes and invocation outcomes can't tell failure from success.
- **Astro is the only error net, and it turns errors into plain strings.** Throws in middleware, routes and page frontmatter are logged as one `err.stack` string with `cause` stripped, served as an **empty** 500, and recorded with outcome `ok`, not `exception` (P1, P1b, P5 observed). Errors thrown during streamed render give a 200 with a blank page (P10).
- **Logs carry no context.** The only two app log calls (`src/lib/workouts.ts:33,65`) log a plain PostgREST object: no HTTP status, user, route or stack. Workers' structured logs reduce an `Error` passed to `console.error` to `"Error: <message>"`, with no stack and no cause (P9). Any fix has to serialize errors itself.
- **There is no error tracker on the server or the client.** Everything rides on Workers Logs, and nothing in the code produces anything you could alert on except two free-text lines.

## 2. Capture model

- **Runtime:** a single Cloudflare Worker (`wrangler.jsonc:3-4`, main `@astrojs/cloudflare/entrypoints/server`), Astro `output: "server"` (`astro.config.mjs:10`), with streaming on by default (`astro/dist/core/app/base.js:73`). There are no queues, cron jobs, `waitUntil` calls or separate workers.
- **Error tracker:** none. No SDK in `package.json`, no global handlers, no `src/pages/500.astro`.
- **Logging:** Workers Logs (`wrangler.jsonc:13` `observability.enabled: true`) records `console.*` output plus the invocation outcome and status. The app makes exactly two `console.error` calls (`src/lib/workouts.ts:33,65`). Astro's own logger writes `console.error("<time> [ERROR] " + err.stack)` for caught throws (`astro/dist/core/routing/handler.js:102`, `core/logger/impls/console.js:11-22`). Warnings go to `console.info`. Astro writes no per-request access log in production (`astro/dist/core/app/app.js:7`).
- **Capture boundary:** Astro's `try/catch` around middleware, endpoint and page (`astro/dist/core/routing/handler.js:59-108`). Inside it, throws become a logged string plus an empty 500 (`core/errors/default-handler.js:105`), and the Worker returns normally (outcome `ok`). Outside it, child-component errors after streaming starts go to `controller.error(e)` with no log (`runtime/server/render/astro/render.js:66-72`). They surface only as a workerd `exception` outcome on a 200 response.
- **Supabase errors are values, not exceptions.** `auth-js` `getUser()` catches every `AuthError` and returns `{ user: null, error }` (`@supabase/auth-js/dist/module/GoTrueClient.js:2715-2723`). Network failures and 5xx become `AuthRetryableFetchError`. `postgrest-js` returns a plain `{code, details, hint, message}` object with `status` beside it, and network failures return `status: 0` (`@supabase/postgrest-js/dist/index.mjs:416-457, 515-535`). Nothing throws unless the app checks.
- **Scrubbing and sampling:** none in code.
- **Deploy identity:** no version, release or environment value in code (no `version_metadata` binding). Server bundle is unminified (`vite-build-config.js:100`) with no source maps, so stack frames name bundle chunks such as `workouts_BDToiXy9.mjs:16:28`.
- **Client:** React islands with `client:load`. No `window.onerror`, `unhandledrejection` or `astro:hydration-error` listener, and no error boundary. Every form is a native `<form method="POST">`, so failed hydration still submits.

**Assumptions (outside the repo, not findings):**

- Workers Logs is enabled and retained for the production Worker, with default sampling. _(Unconfirmed: the user hasn't looked at production logs.)_
- No alert rules, Logpush or Tail Workers exist. _(Unconfirmed.)_
- Workers Logs attaches the script version id to each invocation, so preview and production can be told apart. _(Unconfirmed.)_
- Supabase Auth logs, rate limits, Site URL and SMTP were not inspected. _(Unconfirmed.)_

## 3. What reaches the logs (runtime probes, observed)

Run locally: `wrangler dev -c dist/server/wrangler.json` on workerd (the same bundle `wrangler deploy` ships), against local Supabase. "Outcome" comes from wrangler's local observability store, the stand-in for Workers Logs.

| Probe    | Failure shape                                          | Response                                         | Logs                                                                             | Outcome       | Verdict                                                         |
| -------- | ------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------- |
| P1       | throw (with `cause`) in `POST /api/workouts`           | 500, empty body                                  | `[ERROR] Error: probe-handler` + stack, **cause missing**                        | ok            | poor                                                            |
| P1b      | throw in `dashboard.astro` frontmatter                 | 500, empty body                                  | same                                                                             | ok            | poor                                                            |
| P5       | throw in middleware                                    | 500, empty body                                  | same                                                                             | ok            | poor                                                            |
| P6       | dashboard query on a missing table                     | **200** + "Nie udało się wczytać treningów…"     | `listRecentWorkouts failed {code:'PGRST205', …}`: no status, user, stack         | ok            | poor                                                            |
| P6b      | insert into a missing column                           | **302** `?error=Nie udało się zapisać treningu…` | `createWorkout failed {code:'PGRST204', …}`                                      | ok            | poor                                                            |
| P7       | unhandled promise rejection                            | 200                                              | **nothing**                                                                      | ok            | missed                                                          |
| P9       | `console.error('x', Error with cause)`                 | 200                                              | structured store: `["probe-log","Error: probe-log-err"]`, **no stack, no cause** | ok            | poor                                                            |
| P10      | throw in `DashboardView.astro` during streamed render  | **200**, 0 body bytes (blank page)               | `Uncaught Error: probe-render` + stack                                           | **exception** | ok-ish (only shape that registers as an exception; status lies) |
| P13      | JSON / empty body to form endpoints                    | 500, empty body                                  | `[ERROR] TypeError: … FormData …`                                                | ok            | poor (a client error logged as a server error)                  |
| **P12a** | **Supabase down**, GET /dashboard with a valid session | **302 /auth/signin**                             | **nothing**                                                                      | ok            | **missed**                                                      |
| **P12b** | Supabase down, sign-in with valid credentials          | 302 `?error=Network connection lost.`            | **nothing**                                                                      | ok            | **missed**                                                      |
| **P12c** | Supabase down, POST /api/workouts with a session       | 302 /auth/signin (workout lost)                  | **nothing**                                                                      | ok            | **missed**                                                      |

## 4. Systemic root causes

**RC1 — Supabase result errors are dropped or turned into strings at the first layer.**

- **Mechanism:** `src/middleware.ts:10-13` destructures only `user`. `signout.ts:7` ignores the whole result. `signin.ts:13-16` and `signup.ts:13-16` forward `error.message` to the browser. `src/lib/workouts.ts:31-35, 63-67` replace the error with a fixed Polish string and never read `status`.
- **Why it exists:** auth-js and postgrest-js return errors instead of throwing (§2), so ignoring them compiles and works on the happy path.
- **Explains:** A1, A2, A3, A4, W1, W2, W3.

**RC2 — "redirect with a message" is the only error channel, and "anonymous" is the default fallback.**

- **Mechanism:** `redirectWithError` (`src/pages/api/workouts.ts:10`), the `?error=` redirects in `signin.ts:16` / `signup.ts:16`, and the 200-with-alert in `dashboard.astro:16-24`. The same mechanism carries user errors (validation, wrong password) and system errors (outage, RLS, schema drift), so nothing separates them by status. The middleware's `user = null` fallback (`middleware.ts:13-16`) makes every auth or config failure look like a logged-out visitor.
- **Why it exists:** good UX for user errors (the form re-renders with a message) was reused for every error.
- **Explains:** A1, A2, W1, W4, W5, A6, P-8 (the known missing-secrets risk).

**RC3 — Astro's built-in catch is the only error boundary, and it turns errors into strings.**

- **Mechanism:**
  - `astro/dist/core/routing/handler.js:101-107` logs `err.stack` as text and returns an empty 500 (no `src/pages/500.astro`). The Worker finishes normally, so the outcome is `ok`.
  - The app adds no outer try/catch in `src/middleware.ts`.
  - Errors after streaming starts (`render.js:66-72`) aren't logged by Astro at all.
- **Why it exists:** framework defaults; nobody added a boundary.
- **Explains:** P-1, P-2, P-5, P-6.

**RC4 — no shared logging helper and no request context.**

- **Mechanism:** the only log calls are `src/lib/workouts.ts:33,65`, ad hoc. Nothing records the user id, request id (`cf-ray`), route, version or step. Passing an `Error` to `console.error` loses its stack and `cause` in the structured logs (P9).
- **Why it exists:** logging was added locally inside the service, not designed.
- **Explains:** W2, P-3, P-4, A8.

## 5. Findings by area

### Auth / session

| #   | Location                                                                                  | Category                           | Severity     | What happens in production                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Fix direction                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `src/middleware.ts:10-13` (+ `:18-21`, `api/workouts.ts:12-15`)                           | missing-throw / flattened-response | **critical** | **User:** when Supabase Auth is down, slow, returning 5xx or rejecting a rotated key, every signed-in user is bounced to `/auth/signin`, and a workout being submitted is lost. **Responder:** a burst of 302s with outcome `ok`, no log line, identical to anonymous traffic (P12a/c observed).                                                                                                                                                                                       | Destructure `error`. Treat `isAuthSessionMissingError` as anonymous. For any other error, log it structured (`name`, `status`, `code`, path) and answer 503 instead of redirecting.                                                                      |
| A2  | `src/pages/api/auth/signin.ts:13-16`, `signup.ts:13-16`                                   | flattened-response / swallowed     | **critical** | **User:** sees whatever the provider said, such as "Network connection lost.", "HTTP 522", "Unexpected token '<'…", or a rate-limit message, phrased as if it were their own mistake. **Responder:** only 302s, no log; the `Location` header isn't in invocation logs (P12b observed). An outage, a rate-limit storm (possibly per Worker egress IP, so unverified hypothesis) and a typo all look the same.                                                                          | Classify the error. For `AuthRetryableFetchError`, `status >= 500`, 429 or `AuthUnknownError`: log `{flow, name, status, code}` (never the email or password) and show a generic "service unavailable". Map known `error.code` values to fixed messages. |
| A3  | `src/pages/api/auth/signout.ts:6-9`                                                       | swallowed                          | high         | **User:** if loading the session fails during an outage, the auth cookies are **not** cleared but the user lands on `/` believing they signed out (risky on a shared device). If the global `/logout` call fails, other devices stay signed in (`GoTrueClient.js:3420-3450`). **Responder:** a 302 and no log.                                                                                                                                                                         | Check `error`. On failure, delete the `sb-*` cookies explicitly and log `{userId, name, status}`.                                                                                                                                                        |
| A4  | `src/pages/api/auth/signup.ts:13-19`, `src/pages/auth/confirm-email.astro:4`              | missing-throw                      | medium       | **User:** `data` is ignored. With confirmation off, the user already has a session but is told "Check your email". The page copy depends on `import.meta.env.DEV`, not on what happened. **Responder:** sign-up outcomes aren't logged, so "users never confirm" can't be told apart from "emails never go out".                                                                                                                                                                       | Branch on `data.session` and `data.user?.identities?.length`, and log one info line per outcome.                                                                                                                                                         |
| A5  | no route handles `code` / `error_code` (no `emailRedirectTo` in `signup.ts:13`)           | coverage-gap                       | medium       | **User:** an expired or reused confirmation link lands on the welcome page with no message. The PKCE verifier cookie is never used. **Responder:** at most a 200 on `/`.                                                                                                                                                                                                                                                                                                               | Add `/auth/callback`: call `exchangeCodeForSession` / `verifyOtp`, render `error_code` to the user, and log failures.                                                                                                                                    |
| A6  | `src/pages/auth/signin.astro:5`, `signup.astro:5` → `ServerError.tsx:13`                  | flattened-response                 | low          | **User:** `?error=` is rendered word for word. Crafted links show attacker text in the trusted error box (text injection, not XSS), and internal provider messages leak. **Responder:** screenshots users report aren't reliable evidence.                                                                                                                                                                                                                                             | Redirect with an error code and map it to copy on the server.                                                                                                                                                                                            |
| A7  | `src/lib/supabase.ts:11-13` + second clients (`dashboard.astro:15`, `api/workouts.ts:23`) | swallowed                          | low          | **User:** usually nothing. The second client reads the original request cookies, not the ones the middleware refreshed, so an expired token is refreshed twice, which adds load toward rate limits. The local `refresh_token_reuse_interval = 10` (`supabase/config.toml:167`) usually absorbs the second refresh. If the reuse window is exceeded, the user may be logged out with no log. **Responder:** nothing logged. _(Downgraded from medium after checking the reuse window.)_ | Create the client once in middleware and pass it via `locals`, or read cookies from `context.cookies`.                                                                                                                                                   |
| A8  | `src/middleware.ts:13`; success paths `signin.ts:19`, `signup.ts:19`, `signout.ts:9`      | missing-context                    | medium       | **User:** a report of "I can't log in" can't be investigated. **Responder:** no user id, request id or auth-outcome events, so there is no baseline sign-in failure rate to spike against.                                                                                                                                                                                                                                                                                             | Have the middleware set request context (`cf-ray`, `userId`). Each auth handler emits one info line per outcome (see fix #2).                                                                                                                            |

### Log workout + dashboard

| #   | Location                                                                       | Category                                 | Severity | What happens in production                                                                                                                                                                                                                                                                                                                                    | Fix direction                                                                                                                                |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | `src/pages/api/workouts.ts:42-45` → `new.astro:6`                              | flattened-response / logged-not-captured | high     | **User:** every insert failure shows the same "Nie udało się zapisać treningu…" message: RLS denial `42501`, check violation `23514`, schema drift `PGRST204` (P6b observed), expired JWT `PGRST301`, 5xx, network error. **Responder:** one `console.error` line. The request is 302 → 200, the same as a success, so failures can't be counted from status. | For non-validation failures, re-render the form with status 500/503 (or return 5xx). Log a stable event key `workout.create.failed`.         |
| W2  | `src/lib/workouts.ts:23,31-35,56,63-67`                                        | identity-lost                            | high     | **User:** callers get only a Polish string and can't tell a retryable network failure (`code:""`, status 0) from an RLS denial or schema drift. **Responder:** HTTP `status` is never logged, and a gateway HTML error logs a whole HTML page as `message`.                                                                                                   | Return or log `{status, code, message, details, hint}` and map to user copy at the page or endpoint.                                         |
| W3  | `src/lib/workouts.ts:23-47`, `dashboard.astro:24`, `DashboardView.astro:71-77` | missing-throw                            | medium   | **User:** if the query runs without the user's JWT (e.g. A7's refresh fails) or the RLS select policy breaks, RLS filters rows instead of raising, so the user sees "Brak treningów z ostatnich 7 dni" and a load of **0**. That is most visible right after a successful insert. **Responder:** a 200 and no log.                                            | Log `{userId, rowCount}` at info level on the dashboard read. The `rls-workouts` integration test already guards against policy regressions. |
| W4  | `src/pages/dashboard.astro:19-24`, `DashboardView.astro:64-70`                 | flattened-response                       | medium   | **User:** a read failure renders as a 200 with an alert. The load is correctly hidden rather than shown as 0 (P6 observed). **Responder:** only the single `console.error` line.                                                                                                                                                                              | Set `Astro.response.status = 503` when `listError` is set.                                                                                   |
| W5  | `src/pages/api/workouts.ts:37-40`                                              | swallowed                                | low      | **User:** the client runs the same validator, so a server-side rejection means a hydration failure, a stale bundle after a deploy, or a timezone mismatch, and a regression blocking everyone is invisible. **Responder:** these become a plain `302 ?error=` and are never logged.                                                                           | Log a warn-level event `workout.validation.rejected_server_side` with the field keys.                                                        |
| W6  | `src/lib/dates.ts:15`                                                          | missing-throw                            | low      | **User:** if the formatter ever lacks a part, "today" becomes `"--"`. Every submission then fails as "date in the future", so a runtime/ICU fault looks like a user error. **Responder:** no signal that the runtime is at fault.                                                                                                                             | Throw when a part is missing.                                                                                                                |

### Platform / plumbing

| #   | Location                                                                                                      | Category                     | Severity     | What happens in production                                                                                                                                                                                                                                                               | Fix direction                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1 | `astro/dist/core/routing/handler.js:101-107`; no `src/pages/500.astro`; no outer catch in `src/middleware.ts` | identity-lost / coverage-gap | high         | **User:** any throw in middleware, a route or page frontmatter gives a blank 500 (P1, P1b, P5 observed). **Responder:** one string log line with `cause` stripped and no route or user. The outcome is `ok`, so filters on exception outcome show nothing.                               | Add an outer try/catch around `next()` in middleware that logs through the shared helper (with `cause` chain and context), plus a `500.astro`. |
| P-2 | `astro/dist/runtime/server/render/astro/render.js:66-72`                                                      | coverage-gap                 | medium       | **User:** a child component that throws after headers are sent gives a 200 with a blank or truncated page. **Responder:** workerd records an `exception` outcome with a stack, but the status says 200 and `cause` is lost (P10 observed).                                               | Keep fallible work in page frontmatter (as `dashboard.astro` does). Document this as a rule.                                                   |
| P-3 | Workers structured logs vs `console.error(msg, err)`                                                          | identity-lost                | medium       | **Responder:** an `Error` object argument is reduced to `"Error: <message>"` with no stack and no cause (P9 observed). Any fix that just passes `err` to `console.error` will still be undiagnosable.                                                                                    | The shared helper serializes errors explicitly: `{name, message, stack, cause: [...], status, code}` as one JSON object.                       |
| P-4 | no `version_metadata` binding; no request id                                                                  | missing-context              | medium       | **Responder:** errors can't be tied to a deploy or correlated across the middleware → route → service steps of one request.                                                                                                                                                              | Add a `version_metadata` binding. Middleware sets `{cfRay, versionId, path, userId}` on `locals` and the helper includes it.                   |
| P-5 | `src/pages/api/workouts.ts:17`, `signin.ts:5`, `signup.ts:5`                                                  | noise                        | low          | **User:** a JSON or empty-body POST (scanners, bad clients) makes `formData()` throw, giving a 500 (P13 observed). **Responder:** an error-level stack, mixing bot noise in with real failures.                                                                                          | Wrap `formData()` and answer 400, logged at warn level without a stack.                                                                        |
| P-6 | no global handler; latent                                                                                     | coverage-gap                 | low          | **Responder:** an unhandled promise rejection leaves nothing at all (P7 observed). There are no floating promises today, so this is latent.                                                                                                                                              | Always await, and add a lint rule (`@typescript-eslint/no-floating-promises`).                                                                 |
| P-7 | client: no `window.onerror` / `unhandledrejection` / `astro:hydration-error` listener                         | coverage-gap                 | low          | **User:** forms degrade to native POST, so impact is limited. **Responder:** zero visibility into client errors.                                                                                                                                                                         | Add a small beacon to a logging endpoint once one exists.                                                                                      |
| P-8 | `src/lib/supabase.ts:6-8`, `middleware.ts:14-16`, `Layout.astro:22`                                           | swallowed                    | low (known)  | **User:** missing secrets show a user-facing banner and every user looks logged out. **Responder:** no log. This is the code mechanism behind the known `infrastructure.md` risk.                                                                                                        | Log an error once per isolate when `createClient()` returns null outside dev.                                                                  |
| P-9 | `astro/dist/core/cookies/cookies.js:116-121,146`                                                              | swallowed                    | low (latent) | **User:** a cookie set after headers are sent is dropped, with only a `console.info` warning, and the `ResponseSentError` guard never fires. If a token refresh ever moves into a child component, users would be logged out silently. **Responder:** an info-level line nobody watches. | Rule: `createClient` only in middleware or page frontmatter.                                                                                   |

## 6. Recommended fix order

1. **Middleware: separate "anonymous" from "auth failed"** (`src/middleware.ts`).
   - What: on `getUser()`, treat `AuthSessionMissingError` as anonymous. For any other error, log it and return 503.
   - Closes A1, most of P12, and part of W3.
   - Effort: a few lines.
   - Constraint: don't 503 public pages for anonymous visitors when only a stale cookie is invalid (`bad_jwt` 403 means anonymous plus clear the cookies, not 503).
2. **Shared `logError(event, err, ctx)` helper plus request context.**
   - What: a helper in `src/lib/` that writes one JSON line, with the error serialized explicitly (P-3). Middleware puts `{cfRay, path, userId, versionId}` in `locals`.
   - Closes P-3, P-4, A8, and the context half of W2.
   - Constraint: log user **id** only, never email or password.
3. **Outer try/catch in middleware around `next()`, plus `src/pages/500.astro`.**
   - Closes P-1, and gives P-5 and future throws context.
   - Constraint: Astro will still log its own string line, so tag the helper's line so log queries count each failure once.
4. **Classify auth route errors** (`signin.ts`, `signup.ts`, `signout.ts`).
   - What: system errors get logged plus a generic message. User errors map from codes to fixed copy via `?error=<code>`. Sign-out failure clears cookies explicitly.
   - Closes A2, A3, A6.
5. **Keep PostgREST error identity and return honest statuses** (`src/lib/workouts.ts`, `api/workouts.ts`, `dashboard.astro`).
   - What: keep `{status, code}`; return 5xx for system failures on insert; set the dashboard to 503 on read error.
   - Closes W1, W2, W4.
6. **The rest:** W5 (server-side validation event), A4/A5 (sign-up outcome and callback route; partly product work), P-8 (log missing config), P-6/P-7/P-9 rules, W6.

The first two fixes alone turn the worst blind spot, a silent auth outage, into a JSON error line with route and user context. Adding an alert on it in the Cloudflare dashboard is then a platform task, outside this repo.

## 7. Changes since last audit

First run. No previous report.

## 8. Method and limits

- **Agents:** auditors for the log-workout + dashboard flow, the auth/session flow and cross-cutting plumbing, all read-only, plus one runtime prober in an isolated git worktree.
- **Spot-checked by hand:**
  - Astro catch-and-stringify (`handler.js:101-107`), confirmed.
  - `getUser` returning errors (`GoTrueClient.js:2715-2723`), confirmed.
  - postgrest network-error object with `status: 0` (`index.mjs:416-457`), confirmed.
  - sign-out failure paths (`GoTrueClient.js:3420-3450`), confirmed.
  - streamed-render error with no log (`render.js:62-72`), confirmed.
  - cookie warning going to `console.info` (`cookies.js:116-121`, `console.js:11-22`), confirmed.
  - The stale-cookie double refresh (A7) was **downgraded** after checking `refresh_token_reuse_interval = 10`.
- **Repo-wide sweep (src/, scripts/, excluding tests):**

  | Pattern                                            | Count |
  | -------------------------------------------------- | ----- |
  | empty catches                                      | 0     |
  | catch without binding                              | 0     |
  | `.catch` to default                                | 0     |
  | `throw` / `new Error`                              | 0     |
  | `console.error` in production code                 | 2     |
  | Supabase results with an ignored or unlogged error | 5     |

- **Runtime:** `npm run build`, then `wrangler dev -c dist/server/wrangler.json --port 8788` (workerd, deploy bundle) against local Supabase. Every probe was observed. Two things are inferred, not observed: how production Workers Logs renders console arguments and outcomes (from the local observability store), and dashboard alerting.
  - **Harness quirk:** occasional "Network connection lost" from wrangler dev after a POST. The suite retries.
  - **Local leftovers:** two probe users in local auth only (`probe-1792775340@example.com`, `probe-1792775428@example.com`).
- **Not verifiable:** whether production Workers Logs keeps `[cause]` for console args (local stdout shows it; the structured store doesn't); real alerting; Supabase-side rate limits per Worker egress IP (A2 hypothesis).
- **Probe harness:** worktree `.claude/worktrees/agent-a2eaed48960ebbaac` (branch `worktree-agent-a2eaed48960ebbaac`, uncommitted `// PROBE` injections triggered by an `x-probe` header in `src/middleware.ts`, `src/pages/api/workouts.ts`, `src/pages/dashboard.astro`, `src/lib/workouts.ts`, `src/components/dashboard/DashboardView.astro`; scripts in `probe/`).
  - **Rerun (~2 min):** `cd .claude/worktrees/agent-a2eaed48960ebbaac && bash probe/suite.sh` writes `probe/results.md`.
  - **To prove a fix:** apply it in the worktree on top of the injections, rerun the suite, and diff `probe/results.md`.
