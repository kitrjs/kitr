---
title: Consent
description: Ask for cookie and tracking consent once, and hold analytics and error reports until people agree.
order: 1
---

# Consent

In much of the world you need a visitor's permission before you load analytics or marketing scripts. `kitr/consent` keeps one record per visitor of what they agreed to, by category, in a cookie the server can read too. [Analytics](/packages/analytics) holds its events until its category is granted, and sends them only then. Your banner is a few lines over `useConsent()`, so it looks like the rest of your app.

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

| Option | Default | Description |
| --- | --- | --- |
| `categories` | `['analytics', 'marketing']` | What the banner offers. `necessary` is always granted. |
| `version` | `1` | Bump it to ask everyone again, for example when you add a vendor. |
| `cookie` | `consent` | The cookie name. |
| `maxAge` | `365` | Days the choice is kept. |
| `analytics` | `'analytics'` | The category analytics waits for. `false` never holds it back. |
| `monitoring` | `false` | The category error reports wait for. By default they aren't held back. |

## Loading other scripts

For a script that isn't a kitr package, like a chat widget or an ad pixel, check the category first and listen for changes:

```tsx
const consent = useConsent()

useEffect(() => {
  if (consent.has('marketing')) loadPixel()
}, [consent])
```

## Tests

`createConsent({ categories: ['analytics'] })` builds a consent service without an app, and `grant`, `rejectAll` and `reset` change it the way a visitor would.
