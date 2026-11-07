---
title: Feature flags
description: Turn features on for some users and off for others, with the same answer on the server and in the browser.
order: 1
---

# Feature flags

Declare every flag once with a default. Providers answer per user; the server resolves once per request and hands the browser the same snapshot, so a page never flips after hydration.

## Install

```sh
kitr add flags
```

```ts
// app/flags.ts
import { defineFlags } from 'kitr/flags'

export const flags = defineFlags({
  newDashboard: { default: false, description: 'The redesigned overview' },
  pageSize: { default: 20 },
})

// config/flags.ts
import { defineConfig, envFlagsProvider, percentageFlagsProvider } from 'kitr/flags'
import { flags } from '#app/flags'

export default defineConfig({
  definitions: flags,
  providers: [envFlagsProvider(), percentageFlagsProvider({ newDashboard: 10 })],
})
```

The first provider with an answer wins; the default closes the chain. `envFlagsProvider` reads `FLAG_NEW_DASHBOARD=true`; `percentageFlagsProvider` turns a flag on for a stable share of user ids; `staticFlagsProvider` takes a map or a function of the context; `openFeatureFlagsProvider(client, flags)` wraps any OpenFeature client.

## Read a flag

```tsx
import { useFlag } from 'kitr/flags/react'

function Overview() {
  const fresh = useFlag<typeof flags, 'newDashboard'>('newDashboard')
  return fresh ? <NewOverview /> : <Overview />
}
```

Outside React: `useFlags(app).value('pageSize')` and `isEnabled('newDashboard')`. Both are synchronous and read the resolved snapshot.

## Same answer on both sides

In the root route's loader, resolve for the request and embed the result; the client provider reads it before the first render:

```tsx
loader: ({ context }) => resolveFlags(context.app, getRequestEvent()),
head: ({ loaderData }) => ({ scripts: [{ type: 'application/json', id: '__kitr_flags__', children: JSON.stringify(loaderData) }] }),
```

`<FlagsScript values={...} />` from `kitr/flags/react` renders the same tag. In a pure SPA the provider calls `resolve()` at boot instead.
