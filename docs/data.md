# Choosing a data source

kitr has four ways to get data: `http`, `api`, `actions` and `realtime`. Components read all four the same way, through [Query](/packages/query). This page says which one to pick.

## The matrix

| Where the data comes from | Use | Why |
| --- | --- | --- |
| Your app calling its own server | [`actions`](/packages/actions) | Call a server function like a local one. No URL to design. |
| A server that other programs also call, such as a mobile app | [`api`](/packages/api) | Real URLs with a typed client and an OpenAPI document. |
| An API someone else owns | [`http`](/packages/http) | A REST client with login tokens and errors in one shape. |
| Updates the server pushes while the screen is open | [`realtime`](/packages/realtime) | Live channels that update the screen without a refetch. |

Two questions settle most cases. Does anything besides your own app call this code? Then use an API route, otherwise an action. Is the server in another repository? Then use `http`.

## What each kit chose

| Kit | Packages | Why |
| --- | --- | --- |
| `app` | `http` | It talks to a backend that already exists. |
| `fullstack` | `http`, `actions`, `api`, `realtime` | One of each, to show the choice. Delete the ones you don't need. |
| `saas` | `http`, `api` | A product often grows a mobile app later, which can call the same API. |
| `server` | `api`, `realtime` | A backend has no UI of its own, so everything is an API route. |
| `realtime` (preset) | `api`, `realtime` | Messages go through a controller, and the channel pushes new ones. |
| `site` (preset) | `api` | A marketing site posts one form, to a controller. |

## Can I mix them?

Yes. One screen can read from an action, `http` and a channel at once. All four share:

- **One error shape.** Every failure is a `KitrError` with `code`, `status`, `message` and `fieldErrors`, so forms show server errors the same way.
- **One query key shape.** `['action', 'projects.list']`, `['api', 'projects.show', { id }]`. A mutation can refresh a list loaded from another source.
- **The same login headers.** `http` and `api` send the token and CSRF header the same way.
- **Cancellation.** Every source stops when its query is cancelled or times out.

Decide per feature, not per project. If the UI and a mobile app need the same operation, write one API route and call it from both.

## Using the shared module directly

Your own package can reuse these pieces from `@kitr/core/request`:

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
| `toEnvelope(error, { mask })` | Turn an error into the JSON sent over the wire. `mask` hides server details. |
| `fromEnvelope(json, status)` | Turn an error response into a `KitrError`, including common shapes from other backends. |
| `okEnvelope`, `failEnvelope`, `unwrapEnvelope` | The `{ ok, data } \| { ok: false, error }` result that actions return from a server function. |
| `keyFor(source, name, ...parts)`, `serializeKey(key)` | The query key, and a stable string for it. |
| `linkSignals(...signals)`, `timeoutSignal(ms)`, `withTimeout(signal, ms)` | One signal from several, and a timeout as a signal. |
| `applyRequestHeaders(headers, options)` | Add the login token and CSRF header without replacing your own headers. |
