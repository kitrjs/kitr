---
title: Analytics
description: Count page views and button clicks, and send them to the analytics service you choose.
order: 1
---

# Analytics

Sooner or later someone asks how many people created a project this week, or which page they left from. `kitr/analytics` gives you four calls (`page`, `track`, `identify` and `reset`) and sends each one to the services you configure: [Google Analytics](https://developers.google.com/analytics/devguides/collection/ga4), [Plausible](https://plausible.io/docs), [PostHog](https://posthog.com/docs/libraries/js), or several at once. Page views are counted for you on every route change, every vendor call is wrapped so a blocked script never breaks a button, and calls can wait in a queue until the visitor agrees to tracking.

The examples on this page follow one scenario: Acme's app at `app.acme.com` counts how often Ada creates a project, which plan Grace's team is on, and when Linus pays an invoice.

`kitr/analytics` runs in the browser. On the server it binds the same service so components render, but no vendor script loads. To record events your server owns (a paid invoice, a cancelled subscription), write them to your database or send them from a [job](/packages/jobs); to report errors rather than usage, use [monitoring](/packages/monitoring).

## Install

```sh
kitr add analytics
```

What `kitr add` does:

- Installs `@kitr/analytics`.
- Adds `() => import('@kitr/analytics/provider')` to `providers` and `'@kitr/analytics'` to `packages` in `kitrrc.ts`.
- Adds `VITE_GA_MEASUREMENT_ID: e.string({ optional: true })` to the `public` block of `app/env.ts`, and `VITE_GA_MEASUREMENT_ID=` to `.env.example` (and to `.env` when that file exists).
- Writes `config/analytics.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Writes `app/analytics.ts`, the typed list of your events, with `sign-in.completed` and `project.created` to start.
- Adds a `## kitr: analytics` section to `AGENTS.md` telling coding agents to track through `useAnalytics<AppEvents>()`, to declare new events in `app/analytics.ts` first, and never to call gtag or posthog directly.

`kitr add analytics` asks no questions. To edit `package.json` without running the package manager, pass the global flag:

```sh
kitr add analytics --no-install
```

The `saas` and `site` kits include analytics. It is a client package, so in a server-only project `kitr add analytics` prints a warning and skips it.

`kitr remove analytics` removes the provider, the `packages` entry, the dependency and the `AGENTS.md` section, and deletes `config/analytics.ts`. It leaves `app/analytics.ts`, the env variable and every `track()` call in your components, which you delete by hand.

## Configure

`kitr add analytics` writes this file:

```ts
// config/analytics.ts
import { defineConfig, googleAnalytics } from 'kitr/analytics'
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

With `VITE_GA_MEASUREMENT_ID` empty the `adapters` list is empty, and the provider picks a default: in development it logs every call to the console, in production it sends nothing. Your buttons work before you have chosen a vendor.

| Option | Default | Description |
| --- | --- | --- |
| `adapters` | `[]` | Where calls go. Each entry is an adapter such as `googleAnalytics()` or `plausible()`. When empty, the provider uses `consoleAdapter()` in development and nothing in production. |
| `enabled` | `true` | Start sending at once. `false` queues every call (up to 100) until `analytics.enable()`. With the [consent](/packages/consent) provider installed, analytics always starts disabled and consent enables it. |
| `pageViews` | `true` | Send `page()` on every route change. `false` leaves page views to you. |
| `globalProps` | none | Props merged into every `page()` and `track()` call, such as the app name or build id. Props on the call win. |
| `debug` | development, when `adapters` is set and [devtools](/packages/devtools) is not installed | Print every call with `console.info('[analytics]', ...)` and print adapter errors with `console.warn`. Off when the provider falls back to the console adapter, which already prints each call. |
| `events` | none | A type-only field that carries your event map. You never set it at run time. |

| Variable | Used for |
| --- | --- |
| `VITE_GA_MEASUREMENT_ID` | Your Google Analytics 4 measurement id, such as `G-ACME12345`. When set, the generated config adds the Google Analytics adapter. |
| `VITE_APP_NAME` | Already in your env. The generated config sends it as the `app` prop on every event. |

Variables that start with `VITE_` are bundled into the browser code. Measurement ids and public project keys are meant to be public; never put a secret API key in one.

## Track your first event

`kitr add` wrote `app/analytics.ts`. It lists every event the app sends, with the props each one carries:

```ts
// app/analytics.ts
import type { EventMap } from 'kitr/analytics'

/** Every event the app sends, with its props. `useAnalytics<AppEvents>()` checks names and props. */
export interface AppEvents extends EventMap {
  'sign-in.completed': { method: 'password' | 'oauth' }
  'project.created': { id: string }
}
```

In a component, get the analytics service with `useAnalytics()` from `kitr/analytics/react` and call `track()` after the thing happened:

```tsx
// app/features/projects/new-project-button.tsx
import { useAnalytics } from 'kitr/analytics/react'
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

Render it on the projects page and click it. In development, with no adapter configured, the browser console shows:

```
[analytics] track project.created { app: 'acme', id: 'prj_42' }
```

The `app` prop comes from `globalProps` in `config/analytics.ts`. The line prints once, from the console adapter the provider uses when `adapters` is empty. With [devtools](/packages/devtools) installed, the call also appears in the Analytics panel.

Set `VITE_GA_MEASUREMENT_ID=G-ACME12345` in `.env`, restart the dev server, and the same click sends a `project.created` event to Google Analytics. No component changes.

## Declare your events

Add a line to `AppEvents` for every new event. Use `undefined` for an event without props:

```ts
// app/analytics.ts
import type { EventMap } from 'kitr/analytics'

export interface AppEvents extends EventMap {
  'sign-in.completed': { method: 'password' | 'oauth' }
  'project.created': { id: string }
  'invoice.paid': { invoiceId: string; amount: number; currency: 'USD' | 'EUR' }
  'team.invited': { teamId: string; role: 'admin' | 'member' }
  'upgrade.clicked': undefined
}
```

`useAnalytics<AppEvents>()` gives your editor the list of names and the props for each, so `analytics.track('inv` completes to `'invoice.paid'` and shows its props:

```tsx
// app/features/invoices/pay-button.tsx
import { useAnalytics } from 'kitr/analytics/react'
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

With an event map, `track()` accepts only its names, each with its own props: a misspelt `'invoce.paid'`, a missing prop or a prop of the wrong type is a type error. Without one (`useAnalytics()` with no type argument), it takes any name and any props.

Name events `object.action` in the past tense (`project.created`, `invoice.paid`), the way the generated file does. Most analytics services group events by name, and one naming rule keeps their dashboards readable.

`defineEvents<AppEvents>()` ties the event map to a config object. It returns its input unchanged and exists for code that builds its own analytics instance:

```ts
// app/features/onboarding/analytics.ts
import { consoleAdapter, createAnalytics, defineEvents } from 'kitr/analytics'
import type { AppEvents } from '#app/analytics'

const config = defineEvents<AppEvents>()({ adapters: [consoleAdapter({ prefix: '[onboarding]' })] })

export const onboardingAnalytics = createAnalytics<AppEvents>(config)
```

## Track page views

The provider sends a page view for you. It renders a small tracker after the app mounts that reads the router from the container and calls `page()`:

- once for the page the visitor lands on, and
- again after every navigation that changes the path.

A change to the search or the hash alone (`/projects?sort=name`) is not a new page view. Each call carries the path and two props:

```ts
// What the tracker sends when Ada opens her projects page
analytics.page('/projects', { url: 'https://app.acme.com/projects', title: 'Projects · Acme' })
// adapters receive: ('/projects', { app: 'acme', url: 'https://app.acme.com/projects', title: 'Projects · Acme' })
```

The tracker needs the router that `createKitrRouter()` from [`kitr/router`](/packages/router) binds into the container. Without one, it sends nothing.

To send page views yourself, turn the automatic ones off:

```ts
// config/analytics.ts
import { defineConfig } from 'kitr/analytics'

export default defineConfig({
  adapters: [],
  pageViews: false,
})
```

Then call `page()` where you decide a page was seen, for example when a wizard step changes but the URL does not:

```tsx
// app/features/onboarding/step.tsx
import { useAnalytics } from 'kitr/analytics/react'
import { useEffect } from 'react'

export function OnboardingStep({ step }: { step: 'team' | 'project' | 'invite' }) {
  const analytics = useAnalytics()
  useEffect(() => {
    analytics.page(`/onboarding/${step}`, { title: `Onboarding: ${step}` })
  }, [analytics, step])
  return null
}
```

If you build the React tree by hand instead of through the provider, render `<TrackPageViews />` from `kitr/analytics/react` once inside it. It renders nothing and does the same work as the provider's tracker.

## Identify a signed-in user

After sign-in, tell the services who the visitor is, so later events join up with their earlier ones. Pass a stable id, never an email address:

```tsx
// app/features/auth/sign-in-form.tsx
import { useAnalytics } from 'kitr/analytics/react'
import type { AppEvents } from '#app/analytics'

export function useAfterSignIn() {
  const analytics = useAnalytics<AppEvents>()
  return (user: { id: string; plan: 'free' | 'team' }) => {
    analytics.identify(user.id, { plan: user.plan })
    analytics.track('sign-in.completed', { method: 'password' })
  }
}
```

Call the returned function when Grace's sign-in succeeds: `afterSignIn({ id: 'usr_grace', plan: 'team' })`. Google Analytics sets `user_id` and the `plan` user property, PostHog calls `posthog.identify('usr_grace', { plan: 'team' })`, and Plausible, which has no user profiles, ignores it. `identify()` does not add `globalProps`.

## Forget the user on sign-out

Call `reset()` when the visitor signs out, so the next person on a shared computer is not counted as them:

```tsx
// app/features/auth/sign-out-button.tsx
import { useAnalytics } from 'kitr/analytics/react'

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

Google Analytics clears `user_id`, PostHog calls `posthog.reset()`, and adapters without a `reset` method skip it.

## Add props to every event

`globalProps` in `config/analytics.ts` are merged into every `page()` and `track()` call. Use them for facts about the build, not about the visitor:

```ts
// config/analytics.ts
import { defineConfig, plausible } from 'kitr/analytics'
import { env } from '#app/env'

export default defineConfig({
  adapters: [plausible({ domain: 'app.acme.com' })],
  globalProps: { app: env.VITE_APP_NAME, release: '2026.11.1' },
})
```

A prop on the call wins over a global prop with the same name: `track('project.created', { id: 'prj_42', release: 'canary' })` sends `release: 'canary'`.

## Track outside a component

Outside React, read the service from the container. In a store, a query hook or a provider, `app.container.use('analytics')` returns the same instance the components use:

```ts
// app/features/projects/create-project.ts
import type { Analytics } from 'kitr/analytics'
import type { KitrApp } from 'kitr/app'
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

Don't import `googleAnalytics()` or `window.gtag` into feature code to send an event. Go through the service, so consent, queuing and every other adapter still apply.

## Adapters

An adapter sends calls to one service. List as many as you like in `adapters`; every call goes to each of them in order. Each adapter loads its own script or client the first time tracking is enabled in the browser, never on the server.

| Adapter | Sends to | Script or client |
| --- | --- | --- |
| `googleAnalytics({ measurementId })` | Google Analytics 4 | Loads `gtag.js` for you. |
| `plausible({ domain, apiHost })` | Plausible, cloud or self-hosted | Loads `script.manual.js` for you. |
| `posthog(client, { apiKey })` | PostHog | You install `posthog-js` and pass it in. |
| `consoleAdapter({ prefix })` | The browser console | None. The development default. |
| `memoryAdapter()` | An array in memory | None. For tests. |

### Google Analytics

Nothing to install. `googleAnalytics()` injects the `gtag.js` script once and turns off gtag's own page views, so the router decides what a page view is.

```ts
// config/analytics.ts
import { defineConfig, googleAnalytics } from 'kitr/analytics'
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

`page()` becomes a `page_view` event with `page_path`, `page_location` and `page_title`. `track('project.created', { id })` becomes `gtag('event', 'project.created', { id })`. GA4 has its own rules for event names; check them in the [GA4 event reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events) before you settle on a naming scheme for an app that sends to GA.

### Plausible

Nothing to install. `plausible()` injects Plausible's manual script (`/js/script.manual.js`) once, with `data-domain` set to your site.

```ts
// config/analytics.ts
import { defineConfig, plausible } from 'kitr/analytics'

export default defineConfig({
  adapters: [plausible({ domain: 'app.acme.com' })],
})
```

For a self-hosted Plausible, point `apiHost` at it. A trailing slash is removed:

```ts
// config/analytics.ts
import { defineConfig, plausible } from 'kitr/analytics'

export default defineConfig({
  adapters: [plausible({ domain: 'app.acme.com', apiHost: 'https://stats.acme.com' })],
})
```

| Option | Default | Description |
| --- | --- | --- |
| `domain` | required | The site as registered in Plausible. |
| `apiHost` | `https://plausible.io` | Where the script is loaded from. |

`page()` sends a `pageview` with the full URL and your props as custom props. `track()` sends a custom event with props. Calls made before the script loads wait in Plausible's own queue. Plausible has no user profiles, so `identify()` and `reset()` do nothing. Create a goal in Plausible for each event name you want to count; see [custom event goals](https://plausible.io/docs/custom-event-goals).

### PostHog

Install the PostHog browser client, then pass it in. kitr does not import `posthog-js` itself, so it stays out of your bundle until you add it:

```sh
pnpm add posthog-js
```

```ts
// config/analytics.ts
import posthogJs from 'posthog-js'
import { defineConfig, posthog } from 'kitr/analytics'
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
import { createEnv, env as e } from 'kitr/env'

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

The adapter calls `posthog.init(apiKey, { api_host, capture_pageview: false, ...config })`. Automatic page views are off so the router drives them; `page()` becomes a `$pageview` capture with `$current_url`. Any object with `init`, `capture`, `identify` and `reset` works as the client (the `PostHogLike` type). See the [posthog-js docs](https://posthog.com/docs/libraries/js) for `config` options.

### Console

`consoleAdapter()` prints each call with `console.info`. It is what the provider uses in development when `adapters` is empty. Add it yourself to see calls next to a real service, with a prefix to tell them apart:

```ts
// config/analytics.ts
import { consoleAdapter, defineConfig, plausible } from 'kitr/analytics'

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

In much of the world you need permission before tracking. Set `enabled: false` and every call waits in a queue instead of going out:

```ts
// config/analytics.ts
import { defineConfig, googleAnalytics } from 'kitr/analytics'
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
import { useAnalytics } from 'kitr/analytics/react'
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

`analytics.enabled` is a plain property, not React state, so the component keeps its own `answered` flag to re-render. This example does not remember the answer across visits; [consent](/packages/consent) stores it in a cookie.

What happens to each call:

- Before `enable()`, calls queue. The queue holds 100; later calls are dropped until you enable.
- `enable()` resolves once every adapter's `init()` has run, then the queue is sent. Calling it again does nothing.
- `disable()` empties the queue and stops sending. Calls made after it queue again and go out if `enable()` is called later.
- `analytics.enabled` tells you which state you are in.

The [consent](/packages/consent) package does all of this for you: it calls `enable()` when the visitor grants the `analytics` category and `disable()` when they withdraw it. When the consent provider is in `kitrrc.ts`, the analytics provider starts disabled on its own, wherever the two providers sit in the list and whatever `enabled` says in `config/analytics.ts`. No tracker script loads and no vendor cookie is set before the visitor agrees. With consent installed, never call `enable()` yourself; let the banner decide.

The one exception is `analytics: false` in `config/consent.ts`, which tells consent not to manage analytics. Analytics then follows its own `enabled` option again.

## Add an adapter at run time

`use()` adds an adapter after the app has started. If analytics is already enabled, the adapter's script loads at once; otherwise it loads on `enable()`. Use it for a service you only want for some visitors, such as session replay for Acme staff:

```tsx
// app/features/staff/staff-tools.tsx
import { posthog } from 'kitr/analytics'
import { useAnalytics } from 'kitr/analytics/react'
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

An added adapter only receives calls made after it was added. `analytics.adapters` lists every adapter by `name`; there is no way to remove one.

## Survive blocked scripts

Ad blockers block analytics scripts, and vendors have outages. Every adapter call runs inside a `try`, and a rejected promise from an adapter is caught, so `track()` never throws into your click handler and the other adapters still receive the call:

```ts
import { createAnalytics, memoryAdapter } from 'kitr/analytics'

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

With `debug` on, each failure prints `[analytics] blocked Error: blocked` as a warning. In production `debug` is off and failures are silent.

## Use it on the server

During server rendering the provider still binds `analytics`, so components that call `useAnalytics()` render the same on both sides. Adapters never load their scripts on the server, because `init()` is skipped when there is no `window`, and the page view tracker runs in an effect, which the server never runs.

Call `track()` from event handlers and effects, never during render or in a route loader. On the server such a call still reaches the adapters, which have no script to deliver it: the console adapter prints it to the server log, and the Google Analytics and Plausible adapters push it onto a global queue that nothing reads. To record a server event, such as a paid invoice, write it from the controller to your database or a [job](/packages/jobs).

## Testing

Pass `memoryAdapter()` in config and assert on its `calls`. Each call is recorded as `{ type, args }`, with `globalProps` already merged in. This test renders the button from [Track your first event](#track-your-first-event) inside a test app and checks the event it sends:

```tsx
// app/features/projects/new-project-button.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { memoryAdapter } from 'kitr/analytics'
import { analyticsProvider } from 'kitr/analytics/provider'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
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
// app/features/projects/analytics.test.ts
import { createAnalytics, memoryAdapter } from 'kitr/analytics'
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

`createTestApp()` boots in the `test` mode, so the provider adds no console adapter and nothing is printed.

## Extend

An adapter is an object that implements `AnalyticsAdapter`. Only `name`, `page` and `track` are required:

```ts
// The interface, from kitr/analytics
export interface AnalyticsAdapter {
  name: string
  init?(): void | Promise<void>
  page(path: string, props?: EventProps & { url?: string; title?: string }): void
  track(event: string, props?: EventProps): void
  identify?(userId: string, traits?: EventProps): void
  reset?(): void
}
```

`init()` runs once, in the browser, the first time tracking is enabled. Load scripts and create clients there, not when the adapter is created, so nothing loads before consent. The other methods should be quick and must not throw; the service catches errors, but an adapter that throws on every call hides real problems.

This adapter sends Acme's events to its own endpoint with `navigator.sendBeacon`, which survives the page closing:

```ts
// app/analytics/acme-adapter.ts
import type { AnalyticsAdapter, EventProps } from 'kitr/analytics'

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
import { defineConfig } from 'kitr/analytics'
import { acmeAdapter } from '#app/analytics/acme-adapter'

export default defineConfig({
  adapters: [acmeAdapter({ endpoint: 'https://app.acme.com/api/events' })],
})
```

See [`AnalyticsAdapter`](/packages/analytics/api#analyticsadapter) in the API reference.

## Devtools

With [devtools](/packages/devtools) installed, the provider adds a devtools adapter that copies every call into the log under the `analytics` channel, and an Analytics panel. The panel shows whether tracking is enabled or still queued, the names of the active adapters, and the last 200 calls with their props. Its actions are Enable (consent given), Disable and Clear events, and each one is also in the command palette.

## Next steps

- [API reference](/packages/analytics/api) for every export and type.
- [Consent](/packages/consent) to hold analytics until visitors agree.
- [Devtools](/packages/devtools) to watch every call while you build.
- [Monitoring](/packages/monitoring) to report errors rather than usage.
- [Router](/packages/router) for the navigations that become page views.
