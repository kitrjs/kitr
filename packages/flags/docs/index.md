---
title: Feature flags
description: Turn features on for some users and off for others, with the same answer on the server and in the browser.
order: 1
---

# Feature flags

Feature flags let you merge unfinished work, turn a feature on for 10% of users, or switch something off in production without a deploy. `kitr/flags` makes them typed: every flag is declared once with a default, so a misspelt flag is a type error. Providers decide the value per user. The server resolves the flags once per request and hands the browser the same values, so a page never flips after it loads.

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

## Providers

| Provider | Answers from |
| --- | --- |
| `envFlagsProvider()` | Environment variables: `FLAG_NEW_DASHBOARD=true` sets `newDashboard`. Good for turning things on per environment. |
| `percentageFlagsProvider({ newDashboard: 10 })` | A stable share of users, by user id. The same user always gets the same answer. |
| `staticFlagsProvider(values)` | A fixed map, or a function of the context such as `({ user }) => ({ beta: user?.role === 'staff' })`. |
| `openFeatureFlagsProvider(client, flags)` | Any [OpenFeature](https://openfeature.dev) client: LaunchDarkly, Flagsmith, Unleash, GrowthBook and others. |

They're asked in order, and the first one with an answer wins. A provider is an object with `resolve(key, context)`, so writing one for your own database takes a few lines.

| Option | Default | Description |
| --- | --- | --- |
| `definitions` | none | The flags from `app/flags.ts`. |
| `providers` | none | Asked in order. With none, every flag is its default. |
| `ttl` | `300` | Seconds the browser keeps its values before `refresh()` asks again. |

## Tests

`createFlags(definitions, { providers: [staticFlagsProvider({ newDashboard: true })] })` builds a flags service with fixed answers, so a test can check both sides of a flag.
