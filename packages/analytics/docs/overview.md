---
title: Overview
description: Count page views and button clicks, and send them to the analytics service you choose.
order: 0
---

# Analytics

## What it is

`@kitr/analytics` is four calls: `page`, `track`, `identify` and `reset`. Declare your events once, call `track` anywhere, and every configured adapter gets it. Page views are counted on each route change, and calls wait until the visitor agrees through [consent](/packages/consent).

Runs in the browser. For server-side events, write to your database or send from a [job](/packages/jobs). For errors, use [monitoring](/packages/monitoring).

## Install

```sh
kitr add analytics
```

Adds `@kitr/analytics`, its provider, `config/analytics.ts` and `app/analytics.ts` for your events. [Every change](/packages/analytics/guide#install).

## Quick start

Declare the events your app sends, with their props:

```ts
// app/analytics.ts
import type { EventMap } from '@kitr/analytics'

export interface AppEvents extends EventMap {
  'sign-in.completed': { method: 'password' | 'oauth' }
  'project.created': { id: string }
}
```

Track one after the thing happened:

```tsx
// app/features/projects/new-project-button.tsx
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

With no adapter configured, the console shows `[analytics] track project.created { app: 'acme', id: 'prj_42' }`. Set `VITE_GA_MEASUREMENT_ID` and the same click reaches Google Analytics. Next in the guide: [Track your first event](/packages/analytics/guide#track-your-first-event).

## Built on

`@kitr/analytics` is a thin adapter layer rather than a wrapper around one SDK. Each adapter speaks to one vendor's script or API:

| Adapter | Vendor docs |
| --- | --- |
| Google Analytics 4 | [GA4 collection guide](https://developers.google.com/analytics/devguides/collection/ga4) |
| Plausible | [Plausible docs](https://plausible.io/docs) |
| PostHog | [PostHog JavaScript library](https://posthog.com/docs/libraries/js) |

kitr adds typed events, page view tracking, the consent queue, error wrapping around vendor calls and a memory adapter for tests.

## Problems it solves

- **Vendor lock-in in every component.** [Adapters](/packages/analytics/guide#adapters).
- **Misspelt event names.** [Declare your events](/packages/analytics/guide#declare-your-events).
- **Page views that miss client-side navigation.** [Track page views](/packages/analytics/guide#track-page-views).
- **Knowing who did it.** [Identify a signed-in user](/packages/analytics/guide#identify-a-signed-in-user).
- **Tracking before consent.** [consent](/packages/consent).
- **Ad blockers breaking the app.** [Survive blocked scripts](/packages/analytics/guide#survive-blocked-scripts).

## Further reading

- [Guide](/packages/analytics/guide).
- [API reference](/packages/analytics/api).
- [GA4](https://developers.google.com/analytics/devguides/collection/ga4), [Plausible](https://plausible.io/docs) and [PostHog](https://posthog.com/docs/libraries/js) docs: event limits, property rules and dashboards for each vendor.
- [Consent](/packages/consent).
- [Monitoring](/packages/monitoring).
- [Devtools](/packages/devtools).
