---
title: Overview
description: Ask for cookie and tracking consent once, and hold analytics and error reports until people agree.
order: 0
---

# Consent

## What it is

`@kitr/consent` records what each visitor agreed to, by category, in a cookie the server can read. `useConsent()` gives your banner the categories and the grant and deny functions. Until a category is granted, [analytics](/packages/analytics) queues its calls.

Runs in the browser. It is not a legal template: you decide the categories and wording.

## Install

```sh
kitr add consent
```

Adds `@kitr/consent`, its provider, `config/consent.ts` and a banner in `app/components/consent-banner.tsx`. [Every change](/packages/consent/guide#install).

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

Mount it once in `app/document.tsx`. Click **Accept all** and a `consent` cookie records the choice; queued analytics calls go out. Click **Only necessary** and they never do. Next in the guide: [Show your first banner](/packages/consent/guide#show-your-first-banner).

## Built on

kitr adds the category model, the hook, the hooks analytics and monitoring listen to, no-flash rendering on the server and a devtools panel.

## Problems it solves

- **Trackers firing before consent.** [Show your first banner](/packages/consent/guide#show-your-first-banner).
- **One switch for everything.** [Offer a choice per category](/packages/consent/guide#offer-a-choice-per-category).
- **Third-party scripts you load yourself.** [Check a category before loading a script](/packages/consent/guide#check-a-category-before-loading-a-script).
- **A banner that flashes on load.** [Show the banner without a flash](/packages/consent/guide#show-the-banner-without-a-flash).
- **Policy changes.** [Ask everyone again](/packages/consent/guide#ask-everyone-again).
- **Error reports with personal data.** [Gate error reports](/packages/consent/guide#gate-error-reports).

## Further reading

- [Guide](/packages/consent/guide).
- [API reference](/packages/consent/api).
- [Analytics](/packages/analytics) and [Monitoring](/packages/monitoring).
- [Storage](/packages/storage).
- [European Data Protection Board guidelines on consent](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en).
