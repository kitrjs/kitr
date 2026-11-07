---
title: Analytics
description: Count page views and button clicks, and send them to the analytics service you choose.
order: 1
---

# Analytics

`page`, `track` and `identify` behind one API. Adapters send the calls to Google Analytics, Plausible, PostHog, the console or your own destination; the router reports page views; events can be typed so a misspelt name is a compile error.

## Install

```sh
kitr add analytics
```

```ts
// config/analytics.ts
import { defineConfig, googleAnalytics, plausible } from 'kitr/analytics'
import { env } from '#app/env'

export default defineConfig({
  adapters: [
    ...(env.VITE_GA_MEASUREMENT_ID ? [googleAnalytics({ measurementId: env.VITE_GA_MEASUREMENT_ID })] : []),
    // plausible({ domain: 'example.com' }), posthog(posthogClient)
  ],
  pageViews: true, // route changes become page() calls
  enabled: true, // false queues events until analytics.enable() (consent banners)
  globalProps: { app: env.VITE_APP_NAME },
})
```

Development logs every call to the console and the devtools Analytics panel; production sends only to the adapters listed.

## Typed events

```ts
// app/analytics.ts
import { defineEvents } from 'kitr/analytics'

export const events = defineEvents<{
  'project.created': { id: string; template: string }
  'checkout.completed': { total: number }
}>()
```

```tsx
import { useAnalytics } from 'kitr/analytics/react'

function Create() {
  const analytics = useAnalytics<typeof events>()
  return <button onClick={() => analytics.track('project.created', { id, template: 'blank' })}>Create</button>
}
```

Outside React: `app.container.use('analytics')`. After sign-in call `identify(userId, traits)`, and `reset()` on sign-out.

## Consent

With [Consent](/packages/consent) installed, analytics stays queued until the visitor grants the configured category; nothing else to wire. Without it, call `enable()` and `disable()` yourself.

## Adapters

An adapter is `{ name, init?, page, track, identify?, reset? }`. `memoryAdapter()` records calls for tests.
