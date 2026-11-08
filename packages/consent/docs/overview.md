---
title: Overview
description: Ask for cookie and tracking consent once, and hold analytics and error reports until people agree.
order: 0
---

# Consent

In much of the world you need a visitor's permission before you load analytics, marketing pixels or session replay. Most consent banners are bolted on: a third-party script that knows nothing about your app, and analytics that start firing before anyone answered. Getting it right means one record of what each visitor agreed to, read by every tracker and by the server.

`@kitr/consent` keeps that record and makes the rest of kitr respect it.

## What it is

`@kitr/consent` keeps one record per visitor of what they agreed to, by category, in a cookie the server can read too. `useConsent()` gives your banner the categories, the current choice and the functions to grant or deny, so the banner is a few lines of your own markup. While a category is not granted, [analytics](/packages/analytics) holds its calls in a queue and, if you ask it to, [monitoring](/packages/monitoring) drops its reports. Scripts you load yourself check a category first.

It runs in the browser. The record lives in a cookie made with [storage](/packages/storage), so server code can read it from the request. It is not a legal template: you decide the categories and the wording.

## Install

```sh
kitr add consent
```

This installs `@kitr/consent`, registers the provider in `kitrrc.ts`, writes `config/consent.ts` with the categories and `app/components/consent-banner.tsx`, a banner you can restyle. The guide's [Install](/packages/consent/guide#install) section lists every change.

## Quick start

The banner `kitr add` wrote is a few lines over `useConsent()`:

```tsx
// app/components/consent-banner.tsx
import { useConsent } from '@kitr/consent/react'

export function ConsentBanner() {
  const { decided, acceptAll, rejectAll } = useConsent()
  if (decided) return null
  return (
    <div role="dialog" aria-label="Cookie consent">
      <span>We use cookies for analytics. You can change your mind in settings.</span>
      <button type="button" onClick={rejectAll}>Only necessary</button>
      <button type="button" onClick={acceptAll}>Accept all</button>
    </div>
  )
}
```

Mount it once in `app/document.tsx`, after the `<Outlet />`. Open the app in a private window and click **Accept all**: the banner disappears, a `consent` cookie records `{ granted: ['necessary', 'analytics', 'marketing'], version: 1 }`, and [analytics](/packages/analytics) sends every call it queued since the page loaded. Click **Only necessary** instead and analytics keeps queuing and never sends. The guide continues from here: [Show your first banner](/packages/consent/guide#show-your-first-banner).

## Built on

`@kitr/consent` is built on kitr's own [storage](/packages/storage) cookies rather than on a consent management vendor. The cookie holds the choice per category, a version and a timestamp, so you can ask everyone again when your policy changes. kitr adds the category model, the React hook, the integration points that analytics and monitoring listen to, the no-flash rendering of the banner on the server, and a devtools panel that shows the current choice.

## Problems it solves

- **Trackers firing before consent.** Analytics queues its calls until the category is granted, then flushes them, and `useConsent()` drives the banner. See [Show your first banner](/packages/consent/guide#show-your-first-banner).
- **One switch for everything.** Categories such as `analytics` and `marketing` can be granted separately. See [Offer a choice per category](/packages/consent/guide#offer-a-choice-per-category).
- **Third-party scripts you load yourself.** Check a category before injecting the script, and load it when the choice changes. See [Check a category before loading a script](/packages/consent/guide#check-a-category-before-loading-a-script).
- **A banner that flashes on load.** The server reads the cookie and renders the page without the banner for visitors who already chose. See [Show the banner without a flash](/packages/consent/guide#show-the-banner-without-a-flash).
- **Policy changes.** Bump the version and every visitor is asked again. See [Ask everyone again](/packages/consent/guide#ask-everyone-again).
- **Error reports with personal data.** Gate monitoring behind a category when your policy requires it. See [Gate error reports](/packages/consent/guide#gate-error-reports).

## Further reading

- [Guide](/packages/consent/guide): install, configure and every task.
- [API reference](/packages/consent/api): every export and type.
- [Analytics](/packages/analytics) and [Monitoring](/packages/monitoring): what is held until consent.
- [Storage](/packages/storage): the cookie the record lives in.
- [European Data Protection Board guidelines on consent](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en): what a valid choice requires.
