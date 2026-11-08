---
title: Overview
description: Count page views and button clicks, and send them to the analytics service you choose.
order: 0
---

# Analytics

Sooner or later someone asks how many people created a project this week, or which page they left from. Answering that means picking an analytics vendor, loading its script, counting page views on every route change, and remembering to track the events that matter. Then the vendor changes, or a second one is added, and every `track` call in the app has to change with it.

`@kitr/analytics` gives your app one small analytics API and sends each call to the services you configure.

## What it is

`@kitr/analytics` is four calls: `page`, `track`, `identify` and `reset`. You declare your events once with their properties, call `track` from components or from plain code, and the package forwards each call to every configured adapter. Page views are counted for you on every route change through [router](/packages/router), every vendor call is wrapped so a blocked script never breaks a button, and calls can wait in a queue until the visitor agrees to tracking through [consent](/packages/consent).

It runs in the browser. On the server the same service is bound so components render, but no vendor script loads. For events your server owns, such as a paid invoice, write them to your database or send them from a [job](/packages/jobs). To report errors rather than usage, use [monitoring](/packages/monitoring).

## Install

```sh
kitr add analytics
```

This installs `@kitr/analytics`, registers the provider in `kitrrc.ts`, writes `config/analytics.ts` and `app/analytics.ts` (your event declarations), and adds the vendor keys to `.env.example`. The guide's [Install](/packages/analytics/guide#install) section lists every change.

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

In development, with no adapter configured, the console shows `[analytics] track project.created { app: 'acme', id: 'prj_42' }`. Set `VITE_GA_MEASUREMENT_ID` in `.env` and the same click reaches Google Analytics with no component changes. The guide continues from here: [Track your first event](/packages/analytics/guide#track-your-first-event).

## Built on

`@kitr/analytics` is a thin adapter layer rather than a wrapper around one SDK. Each adapter speaks to one vendor's script or API:

| Adapter | Vendor docs |
| --- | --- |
| Google Analytics 4 | [GA4 collection guide](https://developers.google.com/analytics/devguides/collection/ga4) |
| Plausible | [Plausible docs](https://plausible.io/docs) |
| PostHog | [PostHog JavaScript library](https://posthog.com/docs/libraries/js) |

kitr adds the typed event declarations, the route listener for page views, the consent queue, the error wrapping around every vendor call, a memory adapter for tests and an `Adapter` interface so you can add a vendor of your own in a few lines.

## Problems it solves

- **Vendor lock-in in every component.** Components call `track('project.created')`; the adapters decide where it goes, and switching or adding a vendor is a config change. See [Adapters](/packages/analytics/guide#adapters).
- **Misspelt event names.** Declared events are typed, so `track('projct.created')` is a compile error and every event's properties are checked. See [Declare your events](/packages/analytics/guide#declare-your-events).
- **Page views that miss client-side navigation.** The provider listens to the router and sends a page view for every route change, not just the first load. See [Track page views](/packages/analytics/guide#track-page-views).
- **Knowing who did it.** `identify` attaches the signed-in user after sign-in and `reset` forgets them on sign-out. See [Identify a signed-in user](/packages/analytics/guide#identify-a-signed-in-user).
- **Tracking before consent.** With [consent](/packages/consent) installed, calls queue until the visitor agrees and flush when they do. See [Wait for consent](/packages/analytics/guide#wait-for-consent).
- **Ad blockers breaking the app.** A blocked or failing vendor script is caught and logged; the button still works. See [Survive blocked scripts](/packages/analytics/guide#survive-blocked-scripts).

## Further reading

- [Guide](/packages/analytics/guide): install, configure and every task.
- [API reference](/packages/analytics/api): every export and type.
- [GA4](https://developers.google.com/analytics/devguides/collection/ga4), [Plausible](https://plausible.io/docs) and [PostHog](https://posthog.com/docs/libraries/js) docs: event limits, property rules and dashboards for each vendor.
- [Consent](/packages/consent): hold analytics until visitors agree.
- [Monitoring](/packages/monitoring): errors rather than usage.
- [Devtools](/packages/devtools): watch every call while you build.
