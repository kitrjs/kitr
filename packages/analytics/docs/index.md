---
title: Analytics
description: Count page views and button clicks, and send them to the analytics service you choose.
order: 1
---

# Analytics

Sooner or later someone asks how many people created a project this week. `@kitr/analytics` gives you four calls, `page`, `track`, `identify` and `reset`, and sends them to [Google Analytics](https://developers.google.com/analytics/devguides/collection/ga4), [Plausible](https://plausible.io/docs), [PostHog](https://posthog.com/docs/libraries/js) or several at once.

> [!SUMMARY]
> Count page views and button clicks, and send them to the analytics service you choose. Add it with `kitr add analytics`; the overview is at [/packages/analytics](/packages/analytics).

Page views are counted for you, and calls can wait until the visitor agrees to tracking.

The examples follow Acme's app at `app.acme.com`: how often Ada creates a project, which plan Grace's team is on, and when Linus pays an invoice.

It runs in the browser. For events your server owns, such as a paid invoice, write them to your database or send them from a [job](/packages/jobs). To report errors rather than usage, use [monitoring](/packages/monitoring).

## Install

```sh
kitr add analytics
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/analytics`.
- Adds `() => import('@kitr/analytics/provider')` to `providers` and `'@kitr/analytics'` to `packages` in `kitrrc.ts`.
- Adds `VITE_GA_MEASUREMENT_ID: e.string({ optional: true })` to the `public` block of `app/env.ts`, and `VITE_GA_MEASUREMENT_ID=` to `.env.example` (and to `.env` when that file exists).
- Writes `config/analytics.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Writes `app/analytics.ts`, the typed list of your events, with `sign-in.completed` and `project.created` to start.
- Adds a `## kitr: analytics` section to `AGENTS.md` telling coding agents to track through `useAnalytics<AppEvents>()`, to declare new events in `app/analytics.ts` first, and never to call gtag or posthog directly.

`kitr add analytics` asks no questions. Pass `--no-install` to skip the package manager. The `saas` and `site` kits include analytics. In a server-only project it prints a warning and skips.

`kitr remove analytics` removes the provider, the `packages` entry, the dependency and the `AGENTS.md` section, and deletes `config/analytics.ts`. It leaves `app/analytics.ts`, the env variable and every `track()` call, which you delete by hand.

</details>

## Configure

`kitr add analytics` writes this file:

```ts
// config/analytics.ts
import { defineConfig, googleAnalytics } from '@kitr/analytics'
import { env } from '#app/env'

/**
 * With no adapters, development logs every event to the console and production sends nothing,
 * so the app works before any vendor is chosen.
 */
export default defineConfig({
  adapters: [
    ...(env.VITE_GA_MEASUREMENT_ID
      ? [googleAnalytics({ measurementId: env.VITE_GA_MEASUREMENT_ID })]
      : []),
    // plausible({ domain: 'example.com' }),
    // posthog(posthogJs, { apiKey: env.VITE_POSTHOG_KEY }),   // pnpm add posthog-js
  ],
  // Consent banners: start queued, then call analytics.enable() once the user agrees.
  // enabled: false,
  globalProps: { app: env.VITE_APP_NAME },
})
```

With `VITE_GA_MEASUREMENT_ID` empty, development logs every call to the console and production sends nothing, so your buttons work before you choose a vendor.

| Option | Default | Description |
| --- | --- | --- |
| `adapters` | `[]` | Where calls go. Each entry is an adapter such as `googleAnalytics()` or `plausible()`. When empty, the provider uses `consoleAdapter()` in development and nothing in production. |
| `enabled` | `true` | Send at once. `false` queues up to 100 calls until `analytics.enable()`. With [consent](/packages/consent), it waits for consent. |
| `pageViews` | `true` | Send `page()` on every route change. `false` leaves page views to you. |
| `globalProps` | none | Props merged into every `page()` and `track()` call, such as the app name or build id. Props on the call win. |
| `debug` | `true` in development | Print every call and adapter error to the console. Off when devtools is installed. |
| `events` | none | A type-only field that carries your event map. You never set it at run time. |

| Variable | Used for |
| --- | --- |
| `VITE_GA_MEASUREMENT_ID` | Your Google Analytics 4 measurement id, such as `G-ACME12345`. When set, the generated config adds the Google Analytics adapter. |
| `VITE_APP_NAME` | Already in your env. The generated config sends it as the `app` prop on every event. |

> [!WARNING] Public variables
> `VITE_` variables are bundled into the browser. Measurement ids and public project keys are fine; never put a secret API key in one.

## Track your first event

`kitr add` wrote `app/analytics.ts`. It lists every event the app sends, with the props each one carries:

```ts
// app/analytics.ts
import type { EventMap } from '@kitr/analytics'

/** Every event the app sends, with its props. `useAnalytics<AppEvents>()` checks names and props. */
export interface AppEvents extends EventMap {
  'sign-in.completed': { method: 'password' | 'oauth' }
  'project.created': { id: string }
}
```

In a component, get the analytics service with `useAnalytics()` from `@kitr/analytics/react` and call `track()` after the thing happened:

```tsx
// app/components/projects/new-project-button.tsx
import { useAnalytics } from '@kitr/analytics/react'
import type { AppEvents } from '#app/analytics'

export function NewProjectButton({ onCreate }: { onCreate: () => Promise<{ id: string }> }) {
  const analytics = useAnalytics<AppEvents>()
  return (
    <button
      type="button"
      onClick={async () => {
        const project = await onCreate()
        analytics.track('project.created', { id: project.id })
      }}
    >
      New project
    </button>
  )
}
```

Click it in development, with no adapter configured, and the console shows:

```
[analytics] track project.created { app: 'acme', id: 'prj_42' }
```

The `app` prop comes from `globalProps`. With [devtools](/packages/devtools) installed, the call also appears in the Analytics panel.

Set `VITE_GA_MEASUREMENT_ID=G-ACME12345` in `.env`, restart, and the same click sends `project.created` to Google Analytics. No component changes.

## Declare your events

Add a line to `AppEvents` for every new event. Use `undefined` for an event without props:

```ts
// app/analytics.ts
import type { EventMap } from '@kitr/analytics'

export interface AppEvents extends EventMap {
  'sign-in.completed': { method: 'password' | 'oauth' }
  'project.created': { id: string }
  'invoice.paid': { invoiceId: string; amount: number; currency: 'USD' | 'EUR' }
  'team.invited': { teamId: string; role: 'admin' | 'member' }
  'upgrade.clicked': undefined
}
```

`useAnalytics<AppEvents>()` gives your editor the names and props, so `analytics.track('inv` completes to `'invoice.paid'`:

```tsx
// app/components/invoices/pay-button.tsx
import { useAnalytics } from '@kitr/analytics/react'
import type { AppEvents } from '#app/analytics'

export function PayButton({ invoiceId, amount }: { invoiceId: string; amount: number }) {
  const analytics = useAnalytics<AppEvents>()
  return (
    <button
      type="button"
      onClick={() => analytics.track('invoice.paid', { invoiceId, amount, currency: 'USD' })}
    >
      Pay {amount} USD
    </button>
  )
}
```

With an event map, a misspelt name, a missing prop or a wrong type is a type error. Without one (`useAnalytics()` with no type argument), `track()` takes anything.

Name events `object.action` in the past tense, like `project.created`, so dashboards stay readable.

<details>
<summary>Building your own instance</summary>

`defineEvents<AppEvents>()` ties the event map to a config object for code that builds its own analytics instance:

```ts
// app/lib/onboarding/analytics.ts
import { consoleAdapter, createAnalytics, defineEvents } from '@kitr/analytics'
import type { AppEvents } from '#app/analytics'

const config = defineEvents<AppEvents>()({ adapters: [consoleAdapter({ prefix: '[onboarding]' })] })

export const onboardingAnalytics = createAnalytics<AppEvents>(config)
```

</details>

## Track page views

The provider calls `page()` once for the landing page and again after every navigation that changes the path. A change to the search or hash alone is not a new page view. Each call carries the path, `url` and `title`:

```ts
// What the tracker sends when Ada opens her projects page
analytics.page('/projects', { url: 'https://app.acme.com/projects', title: 'Projects · Acme' })
// adapters receive: ('/projects', { app: 'acme', url: 'https://app.acme.com/projects', title: 'Projects · Acme' })
```

The tracker needs the router that `createKitrRouter()` from [`@kitr/router`](/packages/router) binds; without one, it sends nothing. To send page views yourself, turn the automatic ones off:

```ts
// config/analytics.ts
import { defineConfig } from '@kitr/analytics'

export default defineConfig({
  adapters: [],
  pageViews: false,
})
```

Then call `page()` where you decide a page was seen, such as a wizard step with no URL change:

```tsx
// app/components/onboarding/step.tsx
import { useAnalytics } from '@kitr/analytics/react'
import { useEffect } from 'react'

export function OnboardingStep({ step }: { step: 'team' | 'project' | 'invite' }) {
  const analytics = useAnalytics()
  useEffect(() => {
    analytics.page(`/onboarding/${step}`, { title: `Onboarding: ${step}` })
  }, [analytics, step])
  return null
}
```


## Identify a signed-in user

After sign-in, tell the services who the visitor is, so later events join up. Pass a stable id, never an email address:

```tsx
// app/components/auth/sign-in-form.tsx
import { useAnalytics } from '@kitr/analytics/react'
import type { AppEvents } from '#app/analytics'

export function useAfterSignIn() {
  const analytics = useAnalytics<AppEvents>()
  return (user: { id: string; plan: 'free' | 'team' }) => {
    analytics.identify(user.id, { plan: user.plan })
    analytics.track('sign-in.completed', { method: 'password' })
  }
}
```

Google Analytics sets `user_id` and the `plan` user property, PostHog calls `posthog.identify`, and Plausible, which has no user profiles, ignores it. `identify()` does not add `globalProps`.

## Forget the user on sign-out

Call `reset()` on sign-out so the next person on a shared computer is not counted as them:

```tsx
// app/components/auth/sign-out-button.tsx
import { useAnalytics } from '@kitr/analytics/react'

export function SignOutButton({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const analytics = useAnalytics()
  return (
    <button
      type="button"
      onClick={async () => {
        await onSignOut()
        analytics.reset()
      }}
    >
      Sign out
    </button>
  )
}
```

Google Analytics clears `user_id` and PostHog calls `posthog.reset()`.

## Add props to every event

`globalProps` are merged into every `page()` and `track()` call. Use them for facts about the build, not the visitor:

```ts
// config/analytics.ts
import { defineConfig, plausible } from '@kitr/analytics'
import { env } from '#app/env'

export default defineConfig({
  adapters: [plausible({ domain: 'app.acme.com' })],
  globalProps: { app: env.VITE_APP_NAME, release: '2026.11.1' },
})
```

A prop on the call wins over a global prop with the same name: `track('project.created', { id: 'prj_42', release: 'canary' })` sends `release: 'canary'`.

## Track outside a component

Outside React, `app.container.use('analytics')` returns the instance the components use:

```ts
// app/lib/projects/create-project.ts
import type { Analytics } from '@kitr/analytics'
import type { KitrApp } from '@kitr/kitr/app'
import type { AppEvents } from '#app/analytics'

export async function createProject(app: KitrApp, name: string) {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const project: { id: string } = await response.json()
  const analytics = app.container.use('analytics') as Analytics<AppEvents>
  analytics.track('project.created', { id: project.id })
  return project
}
```

> [!WARNING]
> Don't call `window.gtag` or an adapter from feature code. Go through the service so consent, queuing and every other adapter still apply.

## Adapters

An adapter sends calls to one service. Every call goes to each listed adapter in order. Each loads its own script the first time tracking is enabled in the browser, never on the server.

| Adapter | Sends to | Script or client |
| --- | --- | --- |
| `googleAnalytics({ measurementId })` | Google Analytics 4 | Loads `gtag.js` for you. |
| `plausible({ domain, apiHost })` | Plausible, cloud or self-hosted | Loads `script.manual.js` for you. |
| `posthog(client, { apiKey })` | PostHog | You install `posthog-js` and pass it in. |
| `consoleAdapter({ prefix })` | The browser console | None. The development default. |
| `memoryAdapter()` | An array in memory | None. For tests. |

### Google Analytics

Nothing to install. `googleAnalytics()` injects `gtag.js` once and turns off gtag's own page views, so the router decides.

```ts
// config/analytics.ts
import { defineConfig, googleAnalytics } from '@kitr/analytics'
import { env } from '#app/env'

export default defineConfig({
  adapters: env.VITE_GA_MEASUREMENT_ID
    ? [googleAnalytics({ measurementId: env.VITE_GA_MEASUREMENT_ID, debug: false })]
    : [],
})
```

Then set the id in `.env`:

```sh
VITE_GA_MEASUREMENT_ID=G-ACME12345
```

| Option | Default | Description |
| --- | --- | --- |
| `measurementId` | required | The `G-` id of your GA4 data stream. |
| `debug` | off | Sets gtag's `debug_mode`, so events show in GA's DebugView. |

`page()` becomes a `page_view` event; `track('project.created', { id })` becomes `gtag('event', 'project.created', { id })`. GA4 has its own rules for event names; see the [GA4 event reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).

### Plausible

Nothing to install. `plausible()` injects Plausible's manual script once.

```ts
// config/analytics.ts
import { defineConfig, plausible } from '@kitr/analytics'

export default defineConfig({
  adapters: [plausible({ domain: 'app.acme.com' })],
})
```

For a self-hosted Plausible, point `apiHost` at it:

```ts
// config/analytics.ts
import { defineConfig, plausible } from '@kitr/analytics'

export default defineConfig({
  adapters: [plausible({ domain: 'app.acme.com', apiHost: 'https://stats.acme.com' })],
})
```

| Option | Default | Description |
| --- | --- | --- |
| `domain` | required | The site as registered in Plausible. |
| `apiHost` | `https://plausible.io` | Where the script is loaded from. |

`page()` sends a `pageview`; `track()` sends a custom event with props. `identify()` and `reset()` do nothing. Create a goal in Plausible for each event name you want to count; see [custom event goals](https://plausible.io/docs/custom-event-goals).

### PostHog

Install the PostHog browser client, then pass it in:

```sh
pnpm add posthog-js
```

```ts
// config/analytics.ts
import posthogJs from 'posthog-js'
import { defineConfig, posthog } from '@kitr/analytics'
import { env } from '#app/env'

export default defineConfig({
  adapters: env.VITE_POSTHOG_KEY
    ? [
        posthog(posthogJs, {
          apiKey: env.VITE_POSTHOG_KEY,
          apiHost: 'https://eu.i.posthog.com',
          config: { autocapture: false },
        }),
      ]
    : [],
})
```

Declare the key in `app/env.ts`:

```ts
// app/env.ts
import { createEnv, env as e } from '@kitr/kitr/env'

export const env = createEnv({
  public: {
    // ...
    VITE_GA_MEASUREMENT_ID: e.string({ optional: true }),
    VITE_POSTHOG_KEY: e.string({ optional: true }),
  },
  server: {},
})
```

Then set it in `.env`:

```sh
VITE_POSTHOG_KEY=phc_acme
```

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | required | Your PostHog project API key. |
| `apiHost` | `https://us.i.posthog.com` | Your PostHog region or proxy. |
| `config` | none | Any other `posthog.init()` options, merged last. |

Automatic page views are off so the router drives them; `page()` becomes a `$pageview` capture. Any object with `init`, `capture`, `identify` and `reset` works as the client. See the [posthog-js docs](https://posthog.com/docs/libraries/js) for `config` options.

### Console

`consoleAdapter()` prints each call with `console.info`; it is the development default. Add it next to a real service, with a prefix:

```ts
// config/analytics.ts
import { consoleAdapter, defineConfig, plausible } from '@kitr/analytics'

export default defineConfig({
  adapters: [plausible({ domain: 'app.acme.com' }), consoleAdapter({ prefix: '[acme]' })],
})
```

```
[acme] page /projects { app: 'acme', url: 'https://app.acme.com/projects', title: 'Projects · Acme' }
[acme] track project.created { app: 'acme', id: 'prj_42' }
```

### Memory

`memoryAdapter()` records every call in its `calls` array as `{ type, args }`. Use it in tests; see [Testing](#testing).

## Wait for consent

Set `enabled: false` and every call waits in a queue instead of going out:

```ts
// config/analytics.ts
import { defineConfig, googleAnalytics } from '@kitr/analytics'
import { env } from '#app/env'

export default defineConfig({
  adapters: env.VITE_GA_MEASUREMENT_ID
    ? [googleAnalytics({ measurementId: env.VITE_GA_MEASUREMENT_ID })]
    : [],
  enabled: false,
})
```

When the visitor agrees, call `enable()`. It loads each adapter's script, then sends the queued calls in order:

```tsx
// app/components/tracking-choice.tsx
import { useAnalytics } from '@kitr/analytics/react'
import { useState } from 'react'

export function TrackingChoice() {
  const analytics = useAnalytics()
  const [answered, setAnswered] = useState(analytics.enabled)
  if (answered) return null
  return (
    <div role="dialog" aria-label="Tracking">
      <p>Acme counts page views to improve the app.</p>
      <button
        type="button"
        onClick={() => {
          void analytics.enable()
          setAnswered(true)
        }}
      >
        Allow
      </button>
      <button
        type="button"
        onClick={() => {
          analytics.disable()
          setAnswered(true)
        }}
      >
        No thanks
      </button>
    </div>
  )
}
```

`analytics.enabled` is a plain property, not React state, so the component keeps its own flag. This does not remember the answer across visits; [consent](/packages/consent) stores it in a cookie.

- Before `enable()`, calls queue (up to 100; later calls are dropped).
- `enable()` runs every adapter's `init()`, then sends the queue. Calling it again does nothing.
- `disable()` empties the queue and stops sending; later calls queue again.

The [consent](/packages/consent) package does this for you: it calls `enable()` when the visitor grants the `analytics` category and `disable()` when they withdraw it. With consent installed, analytics starts disabled whatever `enabled` says, and no script loads before the visitor agrees.

> [!WARNING]
> With consent installed, never call `enable()` yourself; let the banner decide. Set `analytics: false` in `config/consent.ts` to stop consent managing analytics.

## Add an adapter at run time

`use()` adds an adapter after startup, for a service only some visitors need, such as session replay for Acme staff:

```tsx
// app/components/staff/staff-tools.tsx
import { posthog } from '@kitr/analytics'
import { useAnalytics } from '@kitr/analytics/react'
import posthogJs from 'posthog-js'
import { useEffect } from 'react'

export function StaffTools({ email }: { email: string }) {
  const analytics = useAnalytics()
  useEffect(() => {
    if (!email.endsWith('@acme.com')) return
    if (analytics.adapters.some((a) => a.name === 'posthog')) return
    analytics.use(posthog(posthogJs, { apiKey: 'phc_acme_staff' }))
  }, [analytics, email])
  return null
}
```

An added adapter only receives later calls, and cannot be removed. `analytics.adapters` lists them by `name`.

## Survive blocked scripts

Ad blockers and vendor outages cannot break your click handlers: adapter errors are caught, so `track()` never throws and the other adapters still receive the call:

```ts
import { createAnalytics, memoryAdapter } from '@kitr/analytics'

const memory = memoryAdapter()
const analytics = createAnalytics({
  adapters: [
    { name: 'blocked', page: () => {}, track: () => Promise.reject(new Error('blocked')) },
    memory,
  ],
})
await analytics.enable()
analytics.track('project.created', { id: 'prj_42' })
// => no error; memory.calls has the track call
```

With `debug` on, each failure prints as a warning; in production failures are silent.

## Use it on the server

During server rendering `useAnalytics()` renders the same, but no adapter script loads.

> [!WARNING]
> Call `track()` from event handlers and effects, never during render or in a loader. On the server it has no script to deliver it. Record server events in your database or a [job](/packages/jobs).

## Testing

Pass `memoryAdapter()` in config and assert on its `calls`, recorded as `{ type, args }` with `globalProps` merged in:

```tsx
// app/components/projects/new-project-button.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { memoryAdapter } from '@kitr/analytics'
import { analyticsProvider } from '@kitr/analytics/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { describe, expect, it } from 'vitest'
import { NewProjectButton } from './new-project-button'

describe('NewProjectButton', () => {
  it('tracks project.created with the new id', async () => {
    const memory = memoryAdapter()
    const app = await createTestApp({
      providers: [analyticsProvider],
      config: { analytics: { adapters: [memory], globalProps: { app: 'acme' } } },
    })
    renderWithKitr(<NewProjectButton onCreate={async () => ({ id: 'prj_42' })} />, { app })

    fireEvent.click(screen.getByRole('button', { name: 'New project' }))

    await waitFor(() =>
      expect(memory.calls).toContainEqual({
        type: 'track',
        args: ['project.created', { app: 'acme', id: 'prj_42' }],
      }),
    )
  })
})
```

For code outside components, build an instance with `createAnalytics()` and no app at all. This one checks the consent queue:

```ts
// app/lib/projects/analytics.test.ts
import { createAnalytics, memoryAdapter } from '@kitr/analytics'
import { expect, it } from 'vitest'

it('holds events until tracking is enabled', async () => {
  const memory = memoryAdapter()
  const analytics = createAnalytics({ adapters: [memory], enabled: false })

  analytics.track('project.created', { id: 'prj_42' })
  analytics.identify('usr_ada', { plan: 'team' })
  expect(memory.calls).toEqual([])

  await analytics.enable()
  expect(memory.calls).toEqual([
    { type: 'track', args: ['project.created', { id: 'prj_42' }] },
    { type: 'identify', args: ['usr_ada', { plan: 'team' }] },
  ])
})
```

The assertions you will write most:

| Assertion | Checks |
| --- | --- |
| `expect(memory.calls).toContainEqual({ type: 'track', args: ['invoice.paid', expect.objectContaining({ invoiceId: 'inv_7' })] })` | An event was sent with a prop, ignoring the others. |
| `expect(memory.calls.filter((c) => c.type === 'page')).toHaveLength(1)` | One page view. |
| `expect(memory.calls).toContainEqual({ type: 'reset', args: [] })` | Sign-out cleared the user. |
| `expect(analytics.enabled).toBe(false)` | Nothing goes out before consent. |


## Extend

An adapter is an object that implements `AnalyticsAdapter`. Only `name`, `page` and `track` are required:

```ts
// The interface, from @kitr/analytics
export interface AnalyticsAdapter {
  name: string
  init?(): void | Promise<void>
  page(path: string, props?: EventProps & { url?: string; title?: string }): void
  track(event: string, props?: EventProps): void
  identify?(userId: string, traits?: EventProps): void
  reset?(): void
}
```

`init()` runs once, in the browser, the first time tracking is enabled. Load scripts there, not at creation, so nothing loads before consent. The other methods should be quick and must not throw.

This adapter sends events to Acme's endpoint with `navigator.sendBeacon`, which survives the page closing:

```ts
// app/analytics/acme-adapter.ts
import type { AnalyticsAdapter, EventProps } from '@kitr/analytics'

export function acmeAdapter(options: { endpoint: string }): AnalyticsAdapter {
  let userId: string | undefined
  const send = (type: string, name: string, props?: EventProps) => {
    const body = JSON.stringify({ type, name, props, userId, at: new Date().toISOString() })
    if (!navigator.sendBeacon(options.endpoint, body)) {
      void fetch(options.endpoint, { method: 'POST', body, keepalive: true })
    }
  }
  return {
    name: 'acme',
    page: (path, props) => send('page', path, props),
    track: (event, props) => send('track', event, props),
    identify(id, traits) {
      userId = id
      send('identify', id, traits)
    },
    reset() {
      userId = undefined
    },
  }
}
```

Register it in config like any built-in adapter:

```ts
// config/analytics.ts
import { defineConfig } from '@kitr/analytics'
import { acmeAdapter } from '#app/analytics/acme-adapter'

export default defineConfig({
  adapters: [acmeAdapter({ endpoint: 'https://app.acme.com/api/events' })],
})
```

See [`AnalyticsAdapter`](/packages/analytics/api#analyticsadapter) in the API reference.

## Devtools

With [devtools](/packages/devtools) installed, an Analytics panel shows whether tracking is enabled or queued, the active adapters and the last 200 calls. Enable, Disable and Clear events are also in the command palette.

## Next steps

- [API reference](/packages/analytics/api): every export and type.
- [Consent](/packages/consent): hold analytics until visitors agree.
- [Monitoring](/packages/monitoring): report errors rather than usage.
