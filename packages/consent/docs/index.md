---
title: Consent
description: Ask for cookie and tracking consent once, and hold analytics and error reports until people agree.
order: 1
---

# Consent

One record per visitor, by category, kept in a cookie the server can read too. Analytics stays queued until its category is granted; a banner is a few lines over `useConsent()`.

## Install

```sh
kitr add consent
```

```ts
// config/consent.ts
import { defineConfig } from 'kitr/consent'

export default defineConfig({
  categories: ['analytics', 'marketing'],
  version: 1, // bump to ask everyone again
  analytics: 'analytics', // the category analytics waits for
  monitoring: false, // error reports are not gated
})
```

The recipe adds the provider after analytics and monitoring in `kitrrc.ts` and writes `app/components/consent-banner.tsx`.

## A banner

```tsx
import { useConsent } from 'kitr/consent/react'

export function ConsentBanner() {
  const { decided, acceptAll, rejectAll, grant } = useConsent()
  if (decided) return null
  return (
    <div role="dialog" aria-label="Cookies">
      <p>We use cookies for analytics.</p>
      <button onClick={acceptAll}>Accept</button>
      <button onClick={rejectAll}>Only necessary</button>
      <button onClick={() => grant(['analytics'])}>Analytics only</button>
    </div>
  )
}
```

`decided` is false during server rendering and the first client render, so the banner never flashes for people who already chose. `has('marketing')` answers before loading a third-party script; `reset()` shows the banner again from a settings page.

## On the server

The cookie is a `kitr/storage` item (`consent.cookie`), so `cookies(event).get(consent.cookie)` reads the same record in a controller or loader.
