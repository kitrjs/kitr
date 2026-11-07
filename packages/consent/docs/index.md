---
title: Consent
description: Ask for cookie and tracking consent once, and hold analytics and error reports until people agree.
order: 1
---

# Consent

In much of the world you need a visitor's permission before you load analytics, marketing pixels or session replay. `kitr/consent` keeps one record per visitor of what they agreed to, by category, in a cookie that the server can read too. While a category is not granted, [analytics](/packages/analytics) keeps its calls in a queue and, if you ask it to, [monitoring](/packages/monitoring) drops its reports. Your banner is a few lines over `useConsent()`, so it looks like the rest of your app.

The examples on this page follow one scenario: Acme's app at `app.acme.com` asks Ada for consent on her first visit, holds Google Analytics until she agrees, loads a marketing pixel only for the `marketing` category, and lets Grace change her mind from the settings page.

`kitr/consent` runs in the browser: the provider only gates analytics and monitoring on the client. The record lives in a cookie made with [`kitr/storage`](/packages/storage), so server code can read it from the request. It is not a legal template: you decide the categories and the wording, and your lawyer decides whether they are enough.

## Install

```sh
kitr add consent
```

What `kitr add` does:

- Adds [storage](/packages/storage) first when the project does not have it, because the record is a storage cookie.
- Installs `@kitr/consent`.
- Adds `() => import('@kitr/consent/provider')` to the end of `providers` and `'@kitr/consent'` to `packages` in `kitrrc.ts`.
- Writes `config/consent.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Writes `app/components/consent-banner.tsx`, a banner with "Only necessary" and "Accept all" buttons, styled with Tailwind classes.
- Adds a `## kitr: consent` section to `AGENTS.md` telling coding agents that the banner is the one place consent is asked, never to call `analytics.enable()` by hand, and to check `useConsent().has('marketing')` before loading third-party scripts.

`kitr add consent` asks no questions and writes no env variables. To edit `package.json` without running the package manager, pass the global flag:

```sh
kitr add consent --no-install
```

No kit includes consent. It is a client package, so in a server-only project `kitr add consent` prints a warning and skips it.

`kitr remove consent` removes the provider, the `packages` entry, the dependency and the `AGENTS.md` section, and deletes `config/consent.ts`. It leaves `app/components/consent-banner.tsx` and the place you mounted it, which you delete by hand. Visitors keep their `consent` cookie until it expires.

## Configure

`kitr add consent` writes this file:

```ts
// config/consent.ts
import { defineConfig } from 'kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing'],
  version: 1, // bump to ask everyone again
  analytics: 'analytics', // analytics waits for this category
  monitoring: false, // error reports are not gated
})
```

| Option | Default | Description |
| --- | --- | --- |
| `categories` | `['analytics', 'marketing']` | The categories your banner offers. `necessary` is always granted and never needs listing. `grant()` ignores any category not in this list. |
| `version` | `1` | The version of your consent text. A stored choice with another version counts as undecided, so bumping it asks everyone again. |
| `cookie` | `'consent'` | The cookie name, before the [storage](/packages/storage) prefix is added. |
| `maxAge` | `365` | Days the browser keeps the choice. |
| `analytics` | `'analytics'` | The category [analytics](/packages/analytics) waits for. `false` leaves analytics alone. |
| `monitoring` | `false` | The category [monitoring](/packages/monitoring) waits for. `false` (or leaving it out) never holds error reports back. |

The cookie is written with `SameSite=Lax`, the `maxAge` above, and the cookie defaults from `config/storage.ts` (`path` and `secure`). Its name gets the storage `prefix`, so with `prefix: 'acme-app:'` the browser stores `acme-app:consent`.

The record inside it is JSON:

```json
{ "granted": ["necessary", "analytics"], "decidedAt": "2026-11-07T09:30:00.000Z", "version": 1 }
```

`kitr add analytics` writes its config with `enabled` left at `true`. Before you ship a consent banner, set it to `false`:

```ts
// config/analytics.ts
import { defineConfig, googleAnalytics } from 'kitr/analytics'
import { env } from '#app/env'

export default defineConfig({
  adapters: env.VITE_GA_MEASUREMENT_ID
    ? [googleAnalytics({ measurementId: env.VITE_GA_MEASUREMENT_ID })]
    : [],
  enabled: false,
  globalProps: { app: env.VITE_APP_NAME },
})
```

> **Warning**
> With `enabled` left at `true`, analytics enables itself while the app boots, before the consent provider runs. That loads the vendor's script (`gtag.js`, Plausible or PostHog), which may set cookies, even though consent disables sending a moment later. Set `enabled: false` in `config/analytics.ts` so no tracking script loads before the visitor agrees.

## Show your first banner

`kitr add` wrote this banner:

```tsx
// app/components/consent-banner.tsx
import { useConsent } from 'kitr/consent/react'

/** Mount once in the root layout. Renders nothing once a choice is recorded. */
export function ConsentBanner() {
  const { decided, acceptAll, rejectAll } = useConsent()
  if (decided) return null
  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 border-t bg-background p-4 text-sm">
      <span>We use cookies for analytics. You can change your mind in settings.</span>
      <button type="button" className="rounded-md border px-3 py-1" onClick={rejectAll}>
        Only necessary
      </button>
      <button type="button" className="rounded-md bg-foreground px-3 py-1 text-background" onClick={acceptAll}>
        Accept all
      </button>
    </div>
  )
}
```

Mount it once, in the root layout. Keep the rest of your root route as it is and render the banner after the `<Outlet />`:

```tsx
// app/routes/__root.tsx
import { Outlet } from 'kitr/router'
import { ConsentBanner } from '#app/components/consent-banner'

// ...

function RootLayout() {
  return (
    <>
      <Outlet />
      <ConsentBanner />
    </>
  )
}
```

Open `app.acme.com` in a private window. The banner sits at the bottom of the page. Click "Accept all" and:

1. The banner disappears, because `decided` is now `true`.
2. A `consent` cookie holds `{ granted: ['necessary', 'analytics', 'marketing'], decidedAt, version: 1 }`.
3. The provider calls `analytics.enable()`, which loads the analytics scripts and sends every call that was queued since the page loaded, the first page view included.

Reload the page and the banner stays hidden: the choice is read back from the cookie. Click "Only necessary" instead and the cookie records `['necessary']`; analytics keeps queuing and never sends.

## Offer a choice per category

`grant()` records exactly the categories you pass, plus `necessary`. Use it for a banner with checkboxes:

```tsx
// app/components/consent-banner.tsx
import { useConsent } from 'kitr/consent/react'
import { useState } from 'react'

const labels: Record<string, string> = {
  analytics: 'Usage statistics, so we know which pages help',
  marketing: 'Marketing, so our ads reach people like you',
}

export function ConsentBanner() {
  const { decided, categories, grant, acceptAll, rejectAll } = useConsent()
  const [chosen, setChosen] = useState<string[]>([])
  if (decided) return null
  return (
    <div role="dialog" aria-label="Cookie consent">
      <p>Acme uses cookies. Pick what you allow.</p>
      {categories.map((category) => (
        <label key={category}>
          <input
            type="checkbox"
            checked={chosen.includes(category)}
            onChange={(e) =>
              setChosen((c) => (e.target.checked ? [...c, category] : c.filter((x) => x !== category)))
            }
          />
          {labels[category] ?? category}
        </label>
      ))}
      <button type="button" onClick={rejectAll}>Only necessary</button>
      <button type="button" onClick={() => grant(chosen)}>Save choice</button>
      <button type="button" onClick={acceptAll}>Accept all</button>
    </div>
  )
}
```

`categories` comes from `config/consent.ts`, so adding a category there adds a checkbox. What each action records:

| Call | `granted` afterwards |
| --- | --- |
| `acceptAll()` | `['necessary', 'analytics', 'marketing']` |
| `rejectAll()` | `['necessary']` |
| `grant(['analytics'])` | `['necessary', 'analytics']` |
| `grant(['analytics', 'chat'])` | `['necessary', 'analytics']`, because `chat` is not in `categories` |
| `grant([])` | `['necessary']`, same as `rejectAll()` |

Every one of them sets `decidedAt` to the current time, writes the cookie and notifies subscribers.

## Add a category

Categories are plain strings. Add one to `config/consent.ts` and it appears in `categories`, so a banner that maps over them shows it:

```ts
// config/consent.ts
import { defineConfig } from 'kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing', 'preferences'],
  version: 2, // new category: ask everyone again
  analytics: 'analytics',
  monitoring: false,
})
```

Then check it where the feature lives. Here the projects list only remembers Linus's sort order when he allowed `preferences`:

```tsx
// app/features/projects/use-sort-order.ts
import { useConsent } from 'kitr/consent/react'
import { useEffect, useState } from 'react'

export function useSortOrder() {
  const { has } = useConsent()
  const remember = has('preferences')
  const [order, setOrder] = useState<'name' | 'updated'>('updated')
  useEffect(() => {
    if (!remember) return
    const saved = localStorage.getItem('acme:project-sort')
    if (saved === 'name' || saved === 'updated') setOrder(saved)
  }, [remember])
  const change = (next: 'name' | 'updated') => {
    setOrder(next)
    if (remember) localStorage.setItem('acme:project-sort', next)
  }
  return [order, change] as const
}
```

Bump `version` whenever you add a category, so people who already chose are asked about the new one.

## Hold analytics for a different category

By default analytics waits for `analytics`. Point it at another category, or turn the gate off:

```ts
// config/consent.ts
import { defineConfig } from 'kitr/consent'

export default defineConfig({
  categories: ['statistics', 'marketing'],
  version: 1,
  analytics: 'statistics',
  monitoring: false,
})
```

With `analytics: false`, consent never calls `analytics.enable()` or `disable()`. Use it when you run a cookieless service you are allowed to use without consent, and set `enabled: true` in `config/analytics.ts` again.

## Load a second tracker for one category

Some trackers belong to a different category from your page views, such as a marketing service that sees every event. Add its adapter only after that category is granted, with `analytics.use()`:

```tsx
// app/components/marketing-tracker.tsx
import { posthog } from 'kitr/analytics'
import { useAnalytics } from 'kitr/analytics/react'
import { useConsent } from 'kitr/consent/react'
import posthogJs from 'posthog-js'
import { useEffect } from 'react'

export function MarketingTracker() {
  const { has } = useConsent()
  const analytics = useAnalytics()
  const allowed = has('marketing')
  useEffect(() => {
    if (!allowed || analytics.adapters.some((a) => a.name === 'posthog')) return
    analytics.use(posthog(posthogJs, { apiKey: 'phc_acme_marketing' }))
  }, [allowed, analytics])
  return null
}
```

The adapter receives calls made after it was added. Withdrawing `marketing` does not remove it; if analytics itself stays enabled, the adapter keeps receiving events until the next page load. Gate such a tracker on the same category as analytics if that matters to you.

## Keep the choice for less time

Some regulators expect you to ask again after six months. Set `maxAge` in days, and rename the cookie if another app on the same domain already uses `consent`:

```ts
// config/consent.ts
import { defineConfig } from 'kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing'],
  version: 1,
  cookie: 'acme_consent',
  maxAge: 180,
  analytics: 'analytics',
  monitoring: false,
})
```

When the cookie expires the browser deletes it, the record reads as undecided, and the banner shows again.

## Show the banner without a flash

On the server, the consent service has no cookie to read, so server-rendered HTML always contains the banner. For a visitor who already chose, the client then reads the cookie, renders nothing, and React reports a hydration mismatch while the banner flickers away. Render the banner only after the component has mounted:

```tsx
// app/components/consent-banner.tsx
import { useConsent } from 'kitr/consent/react'
import { useEffect, useState } from 'react'

export function ConsentBanner() {
  const { decided, acceptAll, rejectAll } = useConsent()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || decided) return null
  return (
    <div role="dialog" aria-label="Cookie consent">
      <p>We use cookies for analytics. You can change your mind in settings.</p>
      <button type="button" onClick={rejectAll}>Only necessary</button>
      <button type="button" onClick={acceptAll}>Accept all</button>
    </div>
  )
}
```

The server and the first client render both produce nothing, so hydration matches. Right after mount, the banner appears only for visitors who have not decided. In a single-page app (web `spa` mode), there is no server HTML and the generated banner works as it is.

## Check a category before loading a script

For a script that is not a kitr package, such as an ad pixel or a chat widget, check its category first. `useConsent()` re-renders when the choice changes, so the script loads the moment the visitor agrees:

```tsx
// app/components/marketing-pixel.tsx
import { useConsent } from 'kitr/consent/react'
import { useEffect } from 'react'

export function MarketingPixel() {
  const { has } = useConsent()
  const allowed = has('marketing')
  useEffect(() => {
    if (!allowed || document.getElementById('acme-pixel')) return
    const script = document.createElement('script')
    script.id = 'acme-pixel'
    script.async = true
    script.src = 'https://pixel.acme.com/p.js'
    document.head.appendChild(script)
  }, [allowed])
  return null
}
```

Mount it next to the banner. `has('necessary')` is always `true`; any other category is `true` only when granted in the current version.

Don't put the vendor's `<script>` tag straight into the root layout's `head`. It would load for every visitor before they answer.

## Let visitors change their mind

Visitors must be able to withdraw consent as readily as they gave it. Give your settings page a button that calls `reset()`, which deletes the cookie so the banner shows again:

```tsx
// app/routes/_app/settings/privacy.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useConsent } from 'kitr/consent/react'

export const Route = createFileRoute('/_app/settings/privacy')({
  component: PrivacySettings,
})

function PrivacySettings() {
  const { record, decided, has, grant, reset } = useConsent()
  return (
    <main>
      <h1>Privacy</h1>
      <p>
        {decided
          ? `You chose on ${new Date(record.decidedAt!).toLocaleDateString('en-US')}.`
          : 'You have not chosen yet.'}
      </p>
      <label>
        <input
          type="checkbox"
          checked={has('analytics')}
          onChange={(e) =>
            grant(
              record.granted.filter((c) => c !== 'analytics').concat(e.target.checked ? ['analytics'] : []),
            )
          }
        />
        Usage statistics
      </label>
      <button type="button" onClick={reset}>Ask me again</button>
    </main>
  )
}
```

When Grace unticks "Usage statistics", `grant()` records the remaining categories and the provider calls `analytics.disable()`. Calls stop going out and the queue is emptied. Scripts that already loaded stay in the page until the next full reload, because a browser cannot unload a script.

`reset()` sets the record back to undecided, removes the cookie and notifies subscribers. The provider sees that `analytics` is no longer granted and calls `analytics.disable()`, so nothing is sent until the visitor chooses again.

## Ask everyone again

When you add a vendor or change what a category covers, bump `version`:

```ts
// config/consent.ts
import { defineConfig } from 'kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing'],
  version: 2, // added PostHog session replay to analytics
  analytics: 'analytics',
  monitoring: false,
})
```

A stored record with `version: 1` now reads as undecided: `decided` is `false`, `has('analytics')` is `false`, and the banner shows again. The old cookie stays until the visitor chooses, then it is overwritten. A cookie whose JSON has the wrong shape (for example `granted` that is not an array) is also treated as undecided.

## Gate error reports

Error reports can contain page content and who the visitor is, so some teams treat them like analytics. Name a category in `monitoring` to hold [monitoring](/packages/monitoring) back until it is granted:

```ts
// config/consent.ts
import { defineConfig } from 'kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing'],
  version: 1,
  analytics: 'analytics',
  monitoring: 'analytics',
})
```

While the category is not granted:

- `captureException`, `captureMessage`, `addBreadcrumb` and `setTag` are dropped, not queued. Errors from before consent are never reported.
- `setUser(user)` is remembered but not sent. When the visitor grants the category, the remembered user is sent at once, so you never call `setUser()` twice.
- When the visitor withdraws, monitoring receives `setUser(null)` and drops reports again.

The default, `monitoring: false`, leaves monitoring alone: errors are reported whatever the visitor chose. Many teams treat crash reports as necessary for running the service; decide with whoever owns your privacy policy.

## Read the choice outside React

Outside components, read the service from the container. It has the same actions as the hook, plus `subscribe()` for changes:

```ts
// app/features/consent/track-choices.ts
import type { KitrApp } from 'kitr/app'

export function logConsentChanges(app: KitrApp) {
  const consent = app.container.use('consent')
  console.info('consent at start', consent.get())
  return consent.subscribe((record) => {
    console.info('consent changed', record.granted)
    // => consent changed ['necessary', 'analytics']
  })
}
```

| Member | Returns | Description |
| --- | --- | --- |
| `get()` | `ConsentRecord` | The current record. The same object until the choice changes, so it is safe in `useSyncExternalStore`. |
| `decided()` | `boolean` | Whether the visitor chose, for the current `version`. |
| `has(category)` | `boolean` | Whether a category is granted. Always `true` for `necessary`. |
| `grant(categories)` | `void` | Record exactly these categories plus `necessary`. |
| `acceptAll()` | `void` | Grant every configured category. |
| `rejectAll()` | `void` | Grant only `necessary`. |
| `reset()` | `void` | Forget the choice and delete the cookie. |
| `subscribe(listener)` | `() => void` | Call `listener(record)` after every `grant`, `acceptAll`, `rejectAll` and `reset` on this service. Returns the unsubscribe function. |
| `categories` | `ConsentCategory[]` | The configured categories. |
| `cookie` | `CookieItem<ConsentRecord>` | The [storage](/packages/storage) cookie item that holds the record. |

`kitr/consent` also exports a `useConsent(app)` function that returns this service. Despite the name it is not a hook; in components use `useConsent()` from `kitr/consent/react`.

## Read consent on the server

The record is a cookie, so a server function or loader can read it from the request with `consent.cookie.get(headers)`. Use it to leave a marketing tag out of the HTML entirely for visitors who did not agree:

```ts
// app/features/consent/read-consent.ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createConsent } from 'kitr/consent'
import consentConfig from '#config/consent'

const { cookie } = createConsent(consentConfig)

/** Runs on the server: the categories this visitor granted, or none if they have not chosen. */
export const readConsent = createServerFn({ method: 'GET' }).handler(() => {
  const record = cookie.get(getRequest().headers)
  const current = record.version === (consentConfig.version ?? 1) && Array.isArray(record.granted)
  return current && record.decidedAt ? record.granted : []
})
// => ['necessary', 'analytics'] for Ada, [] for a first visit
```

`cookie.get()` returns the stored record as it is, so check `version` yourself, as above. The cookie name includes the storage prefix, which the [storage](/packages/storage) provider sets on the server too, so the same `config/storage.ts` applies to both sides.

## Testing

Two things are worth testing: that your banner records the right choice, and that tracking waits for it. The test app needs `environment: 'client'`, because the provider only gates analytics in the browser. The DOM environment keeps cookies between tests, so clear them in `afterEach`.

```tsx
// app/components/consent-banner.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { memoryAdapter } from 'kitr/analytics'
import { analyticsProvider } from 'kitr/analytics/provider'
import { consentProvider } from 'kitr/consent/provider'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ConsentBanner } from './consent-banner'

afterEach(() => {
  document.cookie = 'consent=; max-age=0; path=/'
})

describe('ConsentBanner', () => {
  it('holds analytics until Ada accepts', async () => {
    const memory = memoryAdapter()
    const app = await createTestApp({
      environment: 'client',
      providers: [analyticsProvider, consentProvider],
      config: {
        analytics: { adapters: [memory], enabled: false, pageViews: false },
        consent: { categories: ['analytics', 'marketing'] },
      },
    })
    const analytics = app.container.use('analytics')
    renderWithKitr(<ConsentBanner />, { app })

    analytics.track('project.created', { id: 'prj_42' })
    expect(memory.calls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(app.container.use('consent').get().granted).toEqual(['necessary', 'analytics', 'marketing'])
    await waitFor(() =>
      expect(memory.calls).toEqual([{ type: 'track', args: ['project.created', { id: 'prj_42' }] }]),
    )
  })

  it('sends nothing when Ada picks only necessary', async () => {
    const memory = memoryAdapter()
    const app = await createTestApp({
      environment: 'client',
      providers: [analyticsProvider, consentProvider],
      config: { analytics: { adapters: [memory], enabled: false, pageViews: false } },
    })
    renderWithKitr(<ConsentBanner />, { app })

    fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }))
    app.container.use('analytics').track('project.created', { id: 'prj_42' })

    expect(app.container.use('consent').has('analytics')).toBe(false)
    expect(app.container.use('analytics').enabled).toBe(false)
    expect(memory.calls).toEqual([])
  })
})
```

The test uses the generated banner. If you added the mount guard from [Show the banner without a flash](#show-the-banner-without-a-flash), `renderWithKitr` runs the effect for you, so the same test passes.

For logic that only needs the record, `createConsent()` builds a service with no app. It reads and writes `document.cookie`, so it behaves exactly as in the browser:

```ts
// app/features/consent/consent.test.ts
import { createConsent } from 'kitr/consent'
import { afterEach, expect, it } from 'vitest'

afterEach(() => {
  document.cookie = 'consent=; max-age=0; path=/'
})

it('asks again after the version is bumped', () => {
  createConsent({ version: 1 }).acceptAll()
  expect(createConsent({ version: 1 }).decided()).toBe(true)
  expect(createConsent({ version: 2 }).decided()).toBe(false)
})
```

Run tests that touch `document` in a DOM environment (`happy-dom` or `jsdom`).

## Devtools

With [devtools](/packages/devtools) installed, every choice is logged under the `consent` channel as `decided`, with the record as data. Filter the Log panel by `consent` to see what was granted and when. The Analytics panel shows whether analytics is enabled or still queued, and its Enable and Disable actions let you check both states without clearing cookies.

## Next steps

- [API reference](/packages/consent/api) for every export and type.
- [Analytics](/packages/analytics) for what is held until consent.
- [Monitoring](/packages/monitoring) for the error reports you can gate.
- [Storage](/packages/storage) for the cookie the record lives in.
- [European Data Protection Board guidelines on consent](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en) for what a valid choice requires.
