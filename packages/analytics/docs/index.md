---
title: Analytics
description: Count page views and button clicks, and send them to the analytics service you choose.
order: 1
---

# Analytics

`kitr/analytics` gives you one small API (`page`, `track`, `identify`, `reset`) and sends each call to whichever services you configure: Google Analytics, Plausible, PostHog, or several at once. Page views are counted for you on every route change. Switching providers later is a change to one config file, not to every button.

## Install

```sh
kitr add analytics
```

It writes `config/analytics.ts` and `app/analytics.ts`, and adds an optional `VITE_GA_MEASUREMENT_ID` to your env.

Until you add a service, development logs every event to the console (and to [devtools](/packages/devtools)), and production sends nothing. The app works before you've chosen a vendor.

## Choose where events go

```ts
// config/analytics.ts
import { defineConfig, googleAnalytics, plausible } from 'kitr/analytics'
import { env } from '#app/env'

export default defineConfig({
  adapters: [
    ...(env.VITE_GA_MEASUREMENT_ID
      ? [googleAnalytics({ measurementId: env.VITE_GA_MEASUREMENT_ID })]
      : []),
    plausible({ domain: 'example.com' }),
  ],
  globalProps: { app: env.VITE_APP_NAME },
})
```

| Adapter | Setup |
| --- | --- |
| `googleAnalytics({ measurementId })` | Loads gtag for you. |
| `plausible({ domain, apiHost })` | Loads the Plausible script for you. |
| `posthog(posthogJs, { apiKey })` | Pass the `posthog-js` module, installed with `pnpm add posthog-js`. |
| `consoleAdapter()` | Logs every call. |
| `memoryAdapter()` | Keeps calls in an array, for tests. |

An adapter is an object with `page` and `track`, plus optional `init`, `identify` and `reset`. Writing one for another service takes a few lines.

| Option | Default | Description |
| --- | --- | --- |
| `adapters` | none | Where events go. |
| `enabled` | `true` | Set `false` to hold events until `analytics.enable()`, for consent banners. |
| `pageViews` | `true` | Send a page view on every route change. |
| `globalProps` | none | Added to every event, such as the app version. |
| `debug` | development | Log every call to the console. |

## Track events

Declare your events once, with their properties:

```ts
// app/analytics.ts
import type { EventMap } from 'kitr/analytics'

export interface AppEvents extends EventMap {
  'sign-in.completed': { method: 'password' | 'oauth' }
  'project.created': { id: string }
  'upgrade.clicked': undefined
}
```

Then track them from components. A misspelt event name or a missing property is a type error:

```tsx
import { useAnalytics } from 'kitr/analytics/react'
import type { AppEvents } from '#app/analytics'

function CreateButton() {
  const analytics = useAnalytics<AppEvents>()
  return (
    <button onClick={async () => {
      const project = await create()
      analytics.track('project.created', { id: project.id })
    }}>
      New project
    </button>
  )
}
```

After sign-in, call `analytics.identify(user.id, { plan })`. On sign-out, call `analytics.reset()`.

## Consent

Start with `enabled: false`. Calls made before consent wait in a queue, up to 100 of them. When the visitor agrees, call `analytics.enable()` and the queue is sent. `analytics.disable()` stops sending again.

## Safe by default

Every adapter call is wrapped, so a blocked script or a failing vendor never breaks your app. On the server nothing is sent.
