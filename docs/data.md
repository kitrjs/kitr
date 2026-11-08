# Choosing a data source

A full-stack project can install four ways to get data: `http`, `api`, `actions` and `realtime`. They answer four different questions, and all of them end in the same place: a query, a mutation or a subscription that components read through [Query](/packages/query). This page says which one to pick. The idea behind the shared contract is in [Loading and saving data](/docs/data).

## The matrix

| Where the data comes from | Use | Why |
| --- | --- | --- |
| A TanStack Start app calling its own server | [`actions`](/packages/actions) | A function defined once and called like a local one. No URL to design, no client to write, input validated on the server, and `useQuery('projects.list')` is typed from the name. |
| A server other programs also call (a mobile app, a partner, a webhook, a script), or a backend-only project | [`api`](/packages/api) | Real URLs, controllers, middleware, an OpenAPI document and a client typed from the routes, which works from any origin. |
| An API someone else owns (a vendor, another team's service, a Laravel or Rails backend) | [`http`](/packages/http) | A ky client with the login token, refresh on 401, retries and errors in one shape. You describe each endpoint once. |
| Data the server pushes while the screen is open | [`realtime`](/packages/realtime) | Typed channels whose events apply cache effects, so the screen updates without a refetch. |

Two questions settle most cases. Who else calls this code? If only your own React app does, it is an action; if anything else does, it is an API route. Who owns the other end? If it is not this repository, it is `http`.

## What each kit chose

| Kit | Packages | Why |
| --- | --- | --- |
| `app` | `http` | A single-page app against a backend that already exists. There is no server of its own, so there is nothing for actions or API routes to run on. `mocks` answers `http` requests while you build. |
| `fullstack` | `http`, `actions`, `api`, `realtime` | One of each, because the kit has to show the choice. The UI calls its own server through actions, `api` serves what outside clients need, `http` reaches third-party services, and `realtime` carries live updates. Delete the ones the app does not need. |
| `saas` | `http`, `api` | The sign-in routes are cookie-session endpoints, and a product with a dashboard usually grows a mobile app or an integration, so the data layer starts as a public API with a typed client. Actions can be added later beside it. |
| `server` | `api`, `realtime` | A backend has no UI process of its own to call functions from. Everything it exposes is an API route; channels cover the push side. |
| `realtime` (preset) | `api`, `realtime` | The chat room reads and writes messages through a controller, and the `chat` channel feeds the same query cache. |
| `site` (preset) | `api` | A marketing site posts one form, to a controller. |

## Can I mix them?

Yes. The four clients are built on one shared implementation, `@kitr/core/request`, so a screen can read a project list from an action, a billing summary from `http` and a presence feed from a channel, and the components cannot tell which is which.

- **One error envelope.** A failure from any of them is a `KitrError` with the same `code`, `status`, `message`, `data` and `fieldErrors`. The same function turns a response body into that error in `http`, `api` and `actions`, so a form maps server field errors identically whichever one the submit went to.
- **One key shape.** Query keys are `[source, name, ...input]`: `['action', 'projects.list']`, `['api', 'projects.show', { id }, {}]`, `['realtime', 'chat', { room }]`. Objects are written with sorted keys, so equal input always gives equal keys, and a mutation's `invalidate` can name a key from one source to refresh a list loaded from another.
- **Shared auth headers.** `http` and `api` add the bearer token the same way and echo the `kitr-csrf` cookie as `x-csrf-token` on writes, so one session works for both. Actions go through Start's own request, which carries the cookie.
- **One abort path.** Query cancellation reaches every source as an `AbortSignal`, and a timeout is an `AbortSignal` too.

Mixing has one trap: a data source is a choice per call, not per project, so decide it per feature. If the same operation is needed by the UI and by a mobile app, write the API route and let the UI use the typed client; do not write it twice.

## Using the shared module directly

A package or app of your own can reuse the pieces. They are plain functions, with no React and no dependency beyond `@kitr/core`:

```ts
import { applyRequestHeaders, fromEnvelope, keyFor, linkSignals, toEnvelope } from '@kitr/core/request'

const key = keyFor('billing', 'invoices.list', { status: 'open' })

const response = await fetch('/billing/invoices', {
  headers: applyRequestHeaders(new Headers(), { method: 'GET', token }),
  signal: linkSignals(callerSignal, AbortSignal.timeout(10_000)),
})
if (!response.ok) throw fromEnvelope(await response.json().catch(() => undefined), response.status)
```

| Export | What it does |
| --- | --- |
| `toEnvelope(error, { mask })` | Anything thrown as the wire shape of a `KitrError`; `mask` hides a server error's message and data. |
| `fromEnvelope(json, status)` | A response body as a `KitrError`: kitr's own shape round-trips, `{ message }`, `{ error }` and `{ errors: [{ field, message }] }` bodies from other backends are read too. |
| `okEnvelope`, `failEnvelope`, `unwrapEnvelope` | The `{ ok, data } \| { ok: false, error }` result that actions return from a server function. |
| `keyFor(source, name, ...parts)`, `serializeKey(key)` | The query key, and a stable string for it. |
| `linkSignals(...signals)`, `timeoutSignal(ms)`, `withTimeout(signal, ms)` | One signal from several, and a timeout as a signal. |
| `applyRequestHeaders(headers, options)` | Bearer token, CSRF echo on writes and an optional `x-request-id`, never replacing a header you set. |
