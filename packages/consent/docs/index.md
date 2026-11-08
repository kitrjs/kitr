---
title: Consent
description: Ask for cookie and tracking consent once, and hold analytics and error reports until people agree.
order: 1
---

# Consent

In much of the world you need permission before you load analytics or marketing pixels. `@kitr/consent` stores what each visitor agreed to, by category, in a cookie the server can read too. You build the banner with `useConsent()`.

> [!SUMMARY]
> Ask for cookie and tracking consent once, and hold analytics and error reports until people agree. Add it with `kitr add consent`; the overview is at [/packages/consent](/packages/consent).

Until a category is granted, [analytics](/packages/analytics) waits and [monitoring](/packages/monitoring) can hold its reports.

The examples follow Acme's app at `app.acme.com`: Ada is asked on her first visit, and Grace changes her mind from settings.

The provider gates analytics and monitoring in the browser; the record is a [`@kitr/storage`](/packages/storage) cookie that server code can read.

> [!WARNING] Not legal advice
> You decide the categories and the wording, and your lawyer decides whether they are enough.

## Install

```sh
kitr add consent
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/consent`, which brings `@kitr/storage` along as a dependency for its cookie.
- Adds `() => import('@kitr/consent/provider')` to the end of `providers` and `'@kitr/consent'` to `packages` in `kitrrc.ts`.
- Writes `config/consent.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Writes `app/components/consent-banner.tsx`, a banner with "Only necessary" and "Accept all" buttons, styled with Tailwind classes.
- Adds a `## kitr: consent` section to `AGENTS.md` telling coding agents that the banner is the one place consent is asked, never to call `analytics.enable()` by hand, and to check `useConsent().has('marketing')` before loading third-party scripts.

`kitr add consent` asks no questions. Pass `--no-install` to skip the package manager. No kit includes consent. It adds [storage](/packages/storage) first when missing; `config/storage.ts` sets the cookie's prefix, `path` and `secure`.

`kitr remove consent` removes the provider, the `packages` entry, the dependency and the `AGENTS.md` section, and deletes `config/consent.ts`. It leaves the banner component and where you mounted it. Visitors keep their cookie until it expires.

</details>

## Configure

`kitr add consent` writes this file:

```ts
// config/consent.ts
import { defineConfig } from '@kitr/consent'

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

The cookie uses `SameSite=Lax`, the `maxAge` above and the `config/storage.ts` defaults. Its name gets the storage `prefix`, so `prefix: 'acme-app:'` stores `acme-app:consent`. The record inside is JSON:

```json
{ "granted": ["necessary", "analytics"], "decidedAt": "2026-11-07T09:30:00.000Z", "version": 1 }
```

With the provider in `kitrrc.ts`, [analytics](/packages/analytics) starts disabled whatever `enabled` says. No vendor script loads and no vendor cookie is set until the visitor grants `analytics`. You do not need to change `config/analytics.ts`.

## Show your first banner

`kitr add` wrote this banner:

```tsx
// app/components/consent-banner.tsx
import { useConsent } from '@kitr/consent/react'

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

Mount it once, in the document, after the `<Outlet />`:

```tsx
// app/document.tsx
import { HeadContent, Outlet, Scripts } from '@kitr/router'
import { ConsentBanner } from '#app/components/consent-banner'

// ...

export function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <ConsentBanner />
        <Scripts />
      </body>
    </html>
  )
}
```

In a private window the banner sits at the bottom. Click "Accept all" and the banner disappears, a `consent` cookie records the granted categories, and the provider calls `analytics.enable()`, which sends every call queued since load, the first page view included.

Reload and the banner stays hidden. "Only necessary" records `['necessary']`, and analytics never sends.

## Offer a choice per category

`grant()` records exactly the categories you pass, plus `necessary`. Use it for a banner with checkboxes:

```tsx
// app/components/consent-banner.tsx
import { useConsent } from '@kitr/consent/react'
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

`categories` comes from `config/consent.ts`, so a new category adds a checkbox. What each action records:

| Call | `granted` afterwards |
| --- | --- |
| `acceptAll()` | `['necessary', 'analytics', 'marketing']` |
| `rejectAll()` | `['necessary']` |
| `grant(['analytics'])` | `['necessary', 'analytics']` |
| `grant(['analytics', 'chat'])` | `['necessary', 'analytics']`, because `chat` is not in `categories` |
| `grant([])` | `['necessary']`, same as `rejectAll()` |


## Add a category

Categories are plain strings. Add one to `config/consent.ts` and a banner that maps over `categories` shows it:

```ts
// config/consent.ts
import { defineConfig } from '@kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing', 'preferences'],
  version: 2, // new category: ask everyone again
  analytics: 'analytics',
  monitoring: false,
})
```

Then check it where the feature lives. Here the list remembers a sort order only when `preferences` is allowed:

```tsx
// app/hooks/projects/use-sort-order.ts
import { useConsent } from '@kitr/consent/react'
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

> [!WARNING]
> Bump `version` when you add a category, so people who already chose are asked about the new one.

## Hold analytics for a different category

Analytics waits for `analytics` by default. Point it at another category, or turn the gate off:

```ts
// config/consent.ts
import { defineConfig } from '@kitr/consent'

export default defineConfig({
  categories: ['statistics', 'marketing'],
  version: 1,
  analytics: 'statistics',
  monitoring: false,
})
```

With `analytics: false`, consent never calls `enable()` or `disable()`; analytics follows its own `enabled` option. Use it for a cookieless service you may run without consent.

## Load a second tracker for one category

A marketing tracker belongs to a different category than your page views. Add its adapter only after that category is granted, with `analytics.use()`:

```tsx
// app/components/marketing-tracker.tsx
import { posthog } from '@kitr/analytics'
import { useAnalytics } from '@kitr/analytics/react'
import { useConsent } from '@kitr/consent/react'
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

> [!WARNING]
> Withdrawing `marketing` does not remove the adapter; it keeps receiving events until the next page load.

## Keep the choice for less time

Some regulators expect you to ask again after six months. Set `maxAge` in days, and rename the cookie if another app on the domain uses `consent`:

```ts
// config/consent.ts
import { defineConfig } from '@kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing'],
  version: 1,
  cookie: 'acme_consent',
  maxAge: 180,
  analytics: 'analytics',
  monitoring: false,
})
```

When the cookie expires the record reads as undecided and the banner shows again.

## Show the banner without a flash

Server-rendered HTML always contains the banner, so a visitor who already chose sees it flash. Render the banner only after the component has mounted:

```tsx
// app/components/consent-banner.tsx
import { useConsent } from '@kitr/consent/react'
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

In a single-page app (web `spa` mode) there is no server HTML and the generated banner works as it is.

## Check a category before loading a script

For a script that is not a kitr package, such as an ad pixel, check its category first. `useConsent()` re-renders when the choice changes, so the script loads the moment the visitor agrees:

```tsx
// app/components/marketing-pixel.tsx
import { useConsent } from '@kitr/consent/react'
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

> [!WARNING]
> Don't put the vendor's `<script>` tag in the root layout's `head`; it would load for every visitor before they answer.

## Let visitors change their mind

Visitors must be able to withdraw consent as readily as they gave it. A settings button can call `reset()`, which deletes the cookie so the banner shows again:

```ts
// app/routes.ts
app.page('/settings/privacy', { lazy: () => import('./pages/settings/privacy') })
```

```tsx
// app/pages/settings/privacy.tsx
import { useConsent } from '@kitr/consent/react'

export default function PrivacySettings() {
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

When Grace unticks "Usage statistics", the provider calls `analytics.disable()`: calls stop and the queue is emptied. `reset()` does the same and sets the record back to undecided.

> [!WARNING]
> Scripts that already loaded stay in the page until the next full reload; a browser cannot unload a script.

## Ask everyone again

When you add a vendor or change what a category covers, bump `version`:

```ts
// config/consent.ts
import { defineConfig } from '@kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing'],
  version: 2, // added PostHog session replay to analytics
  analytics: 'analytics',
  monitoring: false,
})
```

A stored record with an older `version` reads as undecided, so the banner shows again until the visitor chooses. A cookie with the wrong shape is also undecided.

## Gate error reports

Error reports can contain page content and who the visitor is. Name a category in `monitoring` to hold [monitoring](/packages/monitoring) back until it is granted:

```ts
// config/consent.ts
import { defineConfig } from '@kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing'],
  version: 1,
  analytics: 'analytics',
  monitoring: 'analytics',
})
```

While the category is not granted:

- `captureException`, `captureMessage`, `addBreadcrumb` and `setTag` are dropped, not queued.
- `setUser(user)` is remembered and sent once the category is granted.
- On withdrawal, monitoring receives `setUser(null)` and drops reports again.

The default, `monitoring: false`, reports errors whatever the visitor chose. Decide with whoever owns your privacy policy.

## Read the choice outside React

Outside components, read the service from the container. It has the hook's actions, plus `subscribe()`:

```ts
// app/lib/consent/track-choices.ts
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

`useConsent(app)` from `@kitr/consent` returns this service and is not a hook; in components use `useConsent()` from `@kitr/consent/react`.

## Read consent on the server

A loader can read the cookie with `consent.cookie.get(headers)`, for example to leave a marketing tag out of the HTML for visitors who did not agree:

```ts
// app/lib/consent/read-consent.ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createConsent } from '@kitr/consent'
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

`cookie.get()` returns the record as stored, so check `version` yourself, as above.

## Testing

Test that your banner records the right choice and that tracking waits for it. The test app needs `environment: 'client'`, and cookies persist between tests, so clear them in `afterEach`.

```tsx
// app/components/consent-banner.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { memoryAdapter } from '@kitr/analytics'
import { analyticsProvider } from '@kitr/analytics/provider'
import { consentProvider } from '@kitr/consent/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
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

For logic that only needs the record, `createConsent()` builds a service with no app; it reads and writes `document.cookie`:

```ts
// app/lib/consent/consent.test.ts
import { createConsent } from '@kitr/consent'
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

Run these in a DOM environment (`happy-dom` or `jsdom`).

## Devtools

With [devtools](/packages/devtools) installed, every choice is logged under the `consent` channel. The Analytics panel's Enable and Disable actions let you check both states without clearing cookies.

## Next steps

- [API reference](/packages/consent/api): every export and type.
- [Analytics](/packages/analytics): what is held until consent.
- [Storage](/packages/storage): the cookie the record lives in.
