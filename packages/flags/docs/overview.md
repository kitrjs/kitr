---
title: Overview
description: Turn features on for some users and off for others, with the same answer on the server and in the browser.
order: 0
---

# Feature flags

## What it is

`@kitr/flags` is a typed flag registry with a provider chain. Declare each flag with a default; providers answer per user from an env variable, a percentage rollout, your own rules or a vendor. The server's answer is embedded in the page, so the browser never flickers.

Runs on both sides. Flags are not permissions: for those, use [auth](/packages/auth).

## Install

```sh
kitr add flags
```

Adds `@kitr/flags`, its provider, `app/flags.ts` with two example flags and `config/flags.ts`. [Every change](/packages/flags/guide#install).

## Quick start

In a component, `useFlag` returns a flag's current value and re-renders when it changes:

```tsx
// app/features/dashboard/dashboard_page.tsx
import { useFlag } from '@kitr/flags/react'
import type { flags } from '#app/flags'
import { ClassicDashboard } from './classic_dashboard'
import { NewDashboard } from './new_dashboard'

export function DashboardPage() {
  const redesigned = useFlag<typeof flags, 'new-dashboard'>('new-dashboard')
  return redesigned ? <NewDashboard /> : <ClassicDashboard />
}
```

Set `FLAG_NEW_DASHBOARD=true` and everyone sees the redesign. Remove it and 10% of signed-in users still do, chosen by user id. Next in the guide: [Show a feature to some users](/packages/flags/guide#show-a-feature-to-some-users).

## Built on

kitr adds typed declarations, type coercion from env strings, per-request resolution on the server, the embedded snapshot, the React hooks and a devtools panel.

## Problems it solves

- **Misspelt flag names.** [Declare flags](/packages/flags/guide#declare-flags).
- **Shipping half-built features.** [Show a feature to some users](/packages/flags/guide#show-a-feature-to-some-users).
- **Server and browser disagreeing.** [Send the server's answer to the browser](/packages/flags/guide#send-the-servers-answer-to-the-browser).
- **Flags that change when someone signs in.** [Resolve again after sign-in](/packages/flags/guide#resolve-again-after-sign-in).
- **Vendor lock-in.** [Providers](/packages/flags/guide#providers).
- **Dead flags.** [Retire a flag](/packages/flags/guide#retire-a-flag).

## Further reading

- [Guide](/packages/flags/guide).
- [API reference](/packages/flags/api).
- [OpenFeature](https://openfeature.dev/docs/reference/intro).
- [Auth](/packages/auth).
- [Configuration](/docs/configuration).
