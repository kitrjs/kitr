---
title: Feature flags
description: Turn features on for some users and off for others, with the same answer on the server and in the browser.
order: 1
---

# Feature flags

Feature flags let you merge unfinished work behind a switch, turn a redesign on for 10% of users, or switch a feature off in production without a deploy. `@kitr/flags` declares every flag once, with a typed default, so a misspelt flag is a type error. Providers decide each flag's value per user: an env variable, a stable percentage rollout, your own rules, or any [OpenFeature](https://openfeature.dev/docs/reference/intro) vendor such as LaunchDarkly, Flagsmith or Unleash.

On top of that provider chain kitr adds type coercion, so `FLAG_MAX_UPLOAD_MB=25` arrives as a number, a per-request answer on the server that never leaks from one user to another, and a snapshot the server embeds so the browser starts with the same values.

It runs on both sides: React hooks in the browser, `resolveFlags()` on the server. Flags are not permissions. To decide whether Grace may delete an invoice, use [auth](/packages/auth) abilities. For a value that is the same for everyone in an environment, a [config file](/docs/configuration) is simpler.

The examples on this page follow Acme's dashboard at `app.acme.com`, which is rolling out a redesigned dashboard (`new-dashboard`) and raising the upload limit for invoices (`max-upload-mb`).

## Install

```sh
kitr add flags
```

What `kitr add` does:

- Adds `@kitr/flags` to `dependencies` in `package.json` and installs it. Pass `--no-install` to skip the install.
- Adds `() => import('@kitr/flags/provider')` to `providers` and `'@kitr/flags'` to `packages` in `kitrrc.ts`. The provider binds `flags` in the container.
- Writes `app/flags.ts`, which declares two example flags, and `config/flags.ts`, which lists the providers (see [Configure](#configure)).
- Adds a `## kitr: flags` section to `AGENTS.md`. In a project with React it says: flags live in `app/flags.ts`, components read `useFlag('new-dashboard')` from `@kitr/flags/react`, the server resolves them per request with `resolveFlags` and embeds them with `<FlagsScript />`, and feature switches never read `import.meta.env`. In a server-only project it says: resolve per request with `resolveFlags(app, event, { userId })` from `@kitr/flags/server`, providers ordered in `config/flags.ts`.

It adds no env variables, no scripts and asks no questions. No kit includes flags, so every project adds it with this command.

`kitr remove flags` takes the provider and the package out of `kitrrc.ts`, deletes `config/flags.ts`, removes the dependency and the `AGENTS.md` section. It keeps `app/flags.ts`, because your code imports from it; delete it once nothing does.

## Configure

`kitr add flags` writes two files. The flags themselves:

```ts
// app/flags.ts
import { defineFlags } from '@kitr/flags'

/** Every flag with its default, so unknown flags are a type error. */
export const flags = defineFlags({
  'new-dashboard': { default: false, description: 'The redesigned dashboard' },
  'max-upload-mb': { default: 10 },
})
```

And where their values come from:

```ts
// config/flags.ts
import { defineConfig, envFlagsProvider, percentageFlagsProvider } from '@kitr/flags'
import { flags } from '#app/flags'

export default defineConfig({
  definitions: flags,
  // First provider with an answer wins: FLAG_NEW_DASHBOARD=true in .env, then a 10% rollout.
  providers: [envFlagsProvider(), percentageFlagsProvider({ 'new-dashboard': 10 })],
  // openFeatureFlagsProvider(client) plugs in LaunchDarkly, Flagsmith, Unleash... through OpenFeature.
})
```

| Option | Default | Description |
| --- | --- | --- |
| `definitions` | `{}` | The flags from `app/flags.ts`. A flag not listed here has no value. |
| `providers` | `[]` | Asked in order for each flag; the first with an answer wins. With none, every flag is its default. |
| `ttl` | none | Seconds a snapshot stays fresh in the browser. After that the client resolves every flag again, with the context of its last `resolve()`, so a flag you turn off reaches tabs that are already open. Without it the browser resolves once per page load. |

For each flag, the providers are asked in order. The first that answers with a value of the right type wins. If none does, the flag's `default` from `app/flags.ts` answers. A provider that throws is skipped with a `console.warn`, so a flag service outage falls back to defaults instead of breaking pages.

`envFlagsProvider()` reads one variable per flag. The name is `FLAG_` plus the flag key in upper case, with dashes, dots and camelCase humps turned into underscores:

| Variable | Used for |
| --- | --- |
| `FLAG_NEW_DASHBOARD` | `new-dashboard`: `true`, `1`, `on` or `yes` turn it on; `false`, `0`, `off`, `no` or empty turn it off. |
| `FLAG_MAX_UPLOAD_MB` | `max-upload-mb`: any finite number, such as `25`. |

The env provider reads `process.env`, so it answers on the server. In the browser there is no `process.env` and it stays silent, which is why the server's snapshot matters (see [Send the server's answer to the browser](#send-the-servers-answer-to-the-browser)).

## Show a feature to some users

In a component, `useFlag` from `@kitr/flags/react` returns a flag's current value and re-renders when it changes:

```tsx
// app/components/dashboard/dashboard-page.tsx
import { useFlag } from '@kitr/flags/react'
import type { flags } from '#app/flags'
import { ClassicDashboard } from '#app/components/dashboard/classic-dashboard'
import { NewDashboard } from '#app/components/dashboard/new-dashboard'

export function DashboardPage() {
  const redesigned = useFlag<typeof flags, 'new-dashboard'>('new-dashboard')
  return redesigned ? <NewDashboard /> : <ClassicDashboard />
}
```

Put `FLAG_NEW_DASHBOARD=true` in `.env`, restart the server, and the dashboard switches for everyone. Remove the line and 10% of signed-in users, chosen by user id, still see the redesign through the percentage provider. Everyone else, and every signed-out visitor, sees the classic one.

## Declare flags

Every flag lives in `app/flags.ts`. The `default` sets both the value when no provider answers and the flag's type:

```ts
// app/flags.ts
import { defineFlags } from '@kitr/flags'

export const flags = defineFlags({
  'new-dashboard': { default: false, description: 'The redesigned dashboard' },
  'max-upload-mb': { default: 10, description: 'Largest invoice PDF a team may upload' },
  'invoice-layout': { default: 'classic', description: "'classic' or 'compact' invoice PDFs" },
})
```

| Default | Flag type | Typical use |
| --- | --- | --- |
| `false` | `boolean` | Show or hide a feature. |
| `10` | `number` | A limit or a size. |
| `'classic'` | `string` | A variant name for an experiment. |

`defineFlags` returns its argument with its exact types, so `useFlag<typeof flags, 'max-upload-mb'>` is a `number` and a key that isn't declared is a type error. Write `description` for the person who flips the flag in six months; it is the only documentation a flag gets.

Choose defaults that are safe to fall back to. If the flag service is down, every user gets the default, so a half-finished feature should default to `false`.

## Type the hooks once

`useFlag` needs the flags type to check keys. Instead of repeating `typeof flags` in every component, wrap it once next to the declarations:

```ts
// app/use_flag.ts
import { useFlag } from '@kitr/flags/react'
import type { flags } from '#app/flags'

type AcmeFlags = typeof flags

/** `useAcmeFlag('max-upload-mb')` is a number; an unknown key is a type error. */
export function useAcmeFlag<K extends keyof AcmeFlags & string>(key: K) {
  return useFlag<AcmeFlags, K>(key)
}
```

```tsx
// app/components/invoices/upload-hint.tsx
import { useAcmeFlag } from '#app/use_flag'

export function UploadHint() {
  const maxMb = useAcmeFlag('max-upload-mb')
  return <p>PDFs up to {maxMb} MB.</p>
}
// => <p>PDFs up to 10 MB.</p>   (no provider answered, so the default)
```

Calling `useFlag('max-upload-mb')` with no type arguments also works, but the value is typed as `boolean | string | number` and a typo is not caught.

## Read every flag at once

`useFlags()` from `@kitr/flags/react` returns every flag as one object, for a settings page or a debug panel:

```tsx
// app/components/settings/flags-panel.tsx
import { useFlags } from '@kitr/flags/react'
import type { flags } from '#app/flags'

export function FlagsPanel() {
  const values = useFlags<typeof flags>()
  return <pre>{JSON.stringify(values, null, 2)}</pre>
}
// => { "new-dashboard": false, "max-upload-mb": 10, "invoice-layout": "classic" }
```

The object is frozen and stays the same object until the flags change, so it is safe to pass to memoised children.

## Read a flag outside React

Outside components, get the service from the container with `useFlags(app)` from `@kitr/flags`. Its reads are synchronous and answer from the current snapshot:

```ts
// app/lib/invoices/validate-upload.ts
import type { KitrApp } from 'kitr/app'
import { useFlags } from '@kitr/flags'
import type { flags } from '#app/flags'

export function checkUploadSize(app: KitrApp, file: File) {
  const maxMb = useFlags<typeof flags>(app).value('max-upload-mb')
  if (file.size > maxMb * 1024 * 1024) return `Invoices must be under ${maxMb} MB.`
  return null
}
```

| Method | Returns | Description |
| --- | --- | --- |
| `value(key)` | the flag's type | The current value: the snapshot, or the default before one exists. |
| `isEnabled(key)` | `boolean` | `true` only when the value is exactly `true`. |
| `snapshot()` | all values | One frozen object with every flag. |
| `resolve(context?)` | `Promise` of all values | Ask the providers for `context`. See below. |
| `hydrate(values)` | `void` | Load values the server resolved. |
| `subscribe(listener)` | unsubscribe function | Called after each resolve or hydrate that updates the snapshot. |
| `resolved` | `boolean` | Whether the snapshot came from a resolve or hydrate rather than defaults. |
| `definitions` | the definitions | What `app/flags.ts` declared. |

`isEnabled` is for boolean flags. On a number flag it is always `false`, even for a value of `1`; use `value()` there.

## Read flags on the server

On the server, one process answers many users at once, so flags are resolved per request. `resolveFlags(app, event, context)` from `@kitr/flags/server` asks the providers for this request's user and caches the answer on the request:

```ts
// server/controllers/dashboard-controller.ts
import type { HttpContext } from '@kitr/api'
import { resolveFlags } from '@kitr/flags/server'
import type { flags } from '#app/flags'
import { classicSummary, newSummary } from '#server/dashboard/summaries'

export default class DashboardController {
  async show({ app, event }: HttpContext) {
    const values = await resolveFlags<typeof flags>(app, event)
    return values['new-dashboard'] ? newSummary() : classicSummary()
  }
}
```

The user comes from `locals.user.id` when [auth](/packages/auth) middleware has set it, so a percentage rollout gives Ada the same answer on every request. Pass more context as the third argument; it is merged over the user id and every provider receives it:

```ts
// server/controllers/invoices-controller.ts
import type { HttpContext } from '@kitr/api'
import { resolveFlags } from '@kitr/flags/server'
import type { flags } from '#app/flags'

export default class InvoicesController {
  async uploadLimit({ app, event, locals }: HttpContext) {
    const team = locals.team as { id: string; plan: 'free' | 'pro' }
    const values = await resolveFlags<typeof flags>(app, event, { teamId: team.id, plan: team.plan })
    return { maxMb: values['max-upload-mb'] }
    // => { maxMb: 10 }
  }
}
```

The first call on a request runs the providers; later calls on the same request return the same object without asking again, even with different context. Resolve once, early, with the full context.

Inside a request, the request's own app (a fork of the server app) keeps the resolved values, so `useFlags(app).value('new-dashboard')` in a service called from that request answers for that user. The shared root app never keeps a resolved snapshot: `resolve()` on it returns the values but leaves `value()` at the defaults, so one user's answer can never leak to the next.

## Send the server's answer to the browser

The browser can't read `process.env`, and it may not know the user id when it boots. So the server resolves the flags and embeds the result in the page as a JSON script tag. When the client app boots, the flags provider reads that tag and loads it before the first render, without asking any provider.

`<FlagsScript values={...} />` from `@kitr/flags/react` renders the tag. In a server-rendered app, resolve in the root route's loader and put the tag in the document head:

```ts
// app/server/load_flags.ts
import { createServerFn } from '@kitr/actions'
import { resolveFlags } from '@kitr/flags/server'
import type { flags } from '#app/flags'
import { server } from '#server/main'
import { currentUserId } from '#server/session'

export const loadFlags = createServerFn({ method: 'GET' }).handler(async () => {
  await server.boot()
  return resolveFlags<typeof flags>(server.app, { context: {} }, { userId: await currentUserId() })
})
```

```ts
// app/routes.ts
import { head, RootDocument } from './document'
import { loadFlags } from '#app/server/load_flags'

r.root({ head, loader: () => loadFlags(), component: RootDocument })
```

```tsx
// app/document.tsx
import { FlagsScript } from '@kitr/flags/react'
import { getRouteApi, HeadContent, Outlet, Scripts } from '@kitr/router'

const root = getRouteApi('__root__')

export function RootDocument() {
  const flags = root.useLoaderData()
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <FlagsScript values={flags} />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

The page now carries:

```html
<script type="application/json" id="__kitr_flags__">{"new-dashboard":true,"max-upload-mb":10}</script>
```

Values are escaped (`<` becomes `<`), so a string flag can't close the tag. The client treats the embedded JSON as input: it keeps only declared keys, coerces each to its declared type, and falls back to the default for anything it can't read. A broken tag is ignored, and the provider resolves at boot instead.

Outside React, `flagsScript(values)` from `@kitr/flags/server` returns the same tag as a string, for a server that writes HTML by hand:

```ts
// server/pages/invoice_print.ts
import { flagsScript } from '@kitr/flags/server'

const head = `<head><title>Invoice</title>${flagsScript({ 'invoice-layout': 'compact' })}</head>`
// => <head><title>Invoice</title><script type="application/json" id="__kitr_flags__">{"invoice-layout":"compact"}</script></head>
```

During server rendering, `useFlag` answers from the app that renders the page. When that app has not resolved flags for this request, it renders defaults, and the browser's first render from the embedded snapshot can differ. For UI that must match on the first paint, read the value from the root loader's data on both sides.

In a single-page app with no server rendering, there is nothing to embed. The provider calls `resolve()` at boot in the browser with no context, so env variables and percentage rollouts don't apply until you resolve again with a user (next section).

## Resolve again after sign-in

In the browser, `resolve(context)` updates the snapshot, and every `useFlag` re-renders with the new answer. Call it once you know who the user is:

```tsx
// app/components/auth/after-sign-in.tsx
import { useApp } from '@kitr/react'
import { useEffect } from 'react'

export function ResolveFlagsFor({ userId }: { userId: string }) {
  const app = useApp()
  useEffect(() => {
    void app.container.use('flags').resolve({ userId })
  }, [app, userId])
  return null
}
```

Render `<ResolveFlagsFor userId={user.id} />` inside the signed-in layout. When Linus signs in, the percentage provider places him in or out of the 10%, and the dashboard switches without a reload. Call `resolve({})` on sign-out to drop back to the anonymous answer.

## Providers

A provider answers flags from one source. List them in `config/flags.ts` in priority order: the first one with an answer wins.

| Provider | Answers from | Silent when |
| --- | --- | --- |
| `envFlagsProvider(env?, prefix?)` | `FLAG_*` env variables | The variable is unset, or can't be read as the flag's type. |
| `percentageFlagsProvider(shares, salt?)` | A stable share of user ids | The flag is not in `shares`. |
| `staticFlagsProvider(values)` | A map, or a function of the context | The map has no entry for the flag. |
| `openFeatureFlagsProvider(client, flags)` | Any OpenFeature client | Never: the client returns its own default. |

### Env variables

Built in; nothing to install. Good for turning a flag on per environment, or forcing it in staging:

```ts
// config/flags.ts
import { defineConfig, envFlagsProvider } from '@kitr/flags'
import { flags } from '#app/flags'

export default defineConfig({
  definitions: flags,
  providers: [envFlagsProvider()],
})
```

```sh
FLAG_NEW_DASHBOARD=true
FLAG_MAX_UPLOAD_MB=25
```

Pass a map as the first argument to read from somewhere other than `process.env`, and a prefix as the second: `envFlagsProvider(process.env, 'ACME_FLAG_')` reads `ACME_FLAG_NEW_DASHBOARD`. Changing an env variable needs a server restart.

### Percentage rollout

Built in. Turns a flag on for a share of users, from 0 to 100:

```ts
// config/flags.ts
import { defineConfig, envFlagsProvider, percentageFlagsProvider } from '@kitr/flags'
import { flags } from '#app/flags'

export default defineConfig({
  definitions: flags,
  providers: [envFlagsProvider(), percentageFlagsProvider({ 'new-dashboard': 25 }, 'dashboard-2026')],
})
```

The answer is a hash of the salt, the flag key and the user id, so Ada gets the same answer on every request and every server. Raising 25 to 50 keeps everyone who already had the feature and adds more. Two flags at 50% reach different, independent halves of your users. Change the salt to draw a new sample.

With no `userId` in the context, the provider answers `false`, and since that is an answer, providers after it are not asked. Put overrides such as `envFlagsProvider()` before it.

### Static rules

Built in. A fixed map, or a function of the context for rules you write in code:

```ts
// config/flags.ts
import { defineConfig, envFlagsProvider, staticFlagsProvider } from '@kitr/flags'
import { flags } from '#app/flags'

export default defineConfig({
  definitions: flags,
  providers: [
    envFlagsProvider(),
    staticFlagsProvider((context) => ({
      'new-dashboard': context.teamId === 'design',
      'max-upload-mb': context.plan === 'pro' ? 100 : undefined,
    })),
  ],
})
```

The design team sees the new dashboard. Pro teams get 100 MB; for everyone else `undefined` means "no opinion", so the default of 10 answers. The context holds `userId` plus whatever you passed to `resolveFlags` or `resolve`.

### OpenFeature

Connect any vendor that has an [OpenFeature provider](https://openfeature.dev/ecosystem): LaunchDarkly, Flagsmith, Unleash, GrowthBook, ConfigCat and others. Install the SDK for the side you resolve on, plus your vendor's provider:

```sh
pnpm add @openfeature/server-sdk
```

```ts
// config/flags.ts
import { InMemoryProvider, OpenFeature } from '@openfeature/server-sdk'
import { defineConfig, envFlagsProvider, openFeatureFlagsProvider } from '@kitr/flags'
import { flags } from '#app/flags'

// Replace InMemoryProvider with your vendor's provider, configured with its SDK key.
OpenFeature.setProvider(
  new InMemoryProvider({
    'new-dashboard': { variants: { on: true, off: false }, defaultVariant: 'on', disabled: false },
  }),
)

export default defineConfig({
  definitions: flags,
  providers: [envFlagsProvider(), openFeatureFlagsProvider(OpenFeature.getClient(), flags)],
})
```

The adapter calls `getBooleanValue`, `getNumberValue` or `getStringValue` depending on each flag's declared default, passing the default and the context with `targetingKey` set to `userId`. Your vendor's key goes in `.env` as the vendor's docs say, for example `LAUNCHDARKLY_SDK_KEY=sdk-...`. Because an OpenFeature client always answers (with the default when it has no rule), put it last.

## Values a provider can return

Providers often answer with strings, from env files or remote JSON. Each answer is coerced to the flag's declared type; an answer that can't be read as that type counts as no answer, and the next provider is asked:

| Declared type | Accepted answers | Ignored answers |
| --- | --- | --- |
| `boolean` | `true`/`false`; `'true'`, `'1'`, `'on'`, `'yes'`; `'false'`, `'0'`, `'off'`, `'no'`, `''`; numbers (0 is false) | `'maybe'` |
| `number` | Numbers; strings that parse to a finite number, such as `' 7.5 '` | `'lots'`, `''`, `'12px'`, `'Infinity'`, booleans |
| `string` | Strings; numbers and booleans, turned into strings | None |

```ts
// scripts/coercion_demo.ts
import { createFlags, envFlagsProvider, staticFlagsProvider } from '@kitr/flags'
import { flags } from '#app/flags'

const demo = createFlags(flags, {
  providers: [
    envFlagsProvider({ FLAG_NEW_DASHBOARD: 'yes', FLAG_MAX_UPLOAD_MB: 'lots' }),
    staticFlagsProvider({ 'max-upload-mb': 50 }),
  ],
})
await demo.resolve()
// => { 'new-dashboard': true, 'max-upload-mb': 50, 'invoice-layout': 'classic' }
```

`'lots'` is not a number, so the env provider's answer is ignored and the static provider's `50` wins.

## Retire a flag

A flag is finished when the feature has shipped to everyone. Delete it from `app/flags.ts`:

```ts
// app/flags.ts
import { defineFlags } from '@kitr/flags'

export const flags = defineFlags({
  'max-upload-mb': { default: 10, description: 'Largest invoice PDF a team may upload' },
  'invoice-layout': { default: 'classic', description: "'classic' or 'compact' invoice PDFs" },
})
```

Every typed `useFlag<typeof flags, 'new-dashboard'>` and `resolveFlags<typeof flags>` read of it is now a type error, which lists the code to clean up. Remove the old branch, then the `FLAG_NEW_DASHBOARD` line and the `'new-dashboard'` share in `config/flags.ts`.

## Testing

`createFlags(definitions, config)` builds a flags service with no app. Give it a `staticFlagsProvider` to test both sides of a flag:

```ts
// app/lib/invoices/validate-upload.test.ts
import { createFlags, staticFlagsProvider } from '@kitr/flags'
import { describe, expect, it } from 'vitest'
import { flags } from '#app/flags'

describe('upload limit flag', () => {
  it('answers the default until resolved, then the provider', async () => {
    const service = createFlags(flags, { providers: [staticFlagsProvider({ 'max-upload-mb': 25 })] })
    expect(service.value('max-upload-mb')).toBe(10)
    expect(service.resolved).toBe(false)

    expect(await service.resolve({ userId: 'ada' })).toEqual({
      'new-dashboard': false,
      'max-upload-mb': 25,
      'invoice-layout': 'classic',
    })
    expect(service.value('max-upload-mb')).toBe(25)
  })

  it('targets by context', async () => {
    const service = createFlags(flags, {
      providers: [staticFlagsProvider((ctx) => ({ 'new-dashboard': ctx.userId === 'grace' }))],
    })
    expect((await service.resolve({ userId: 'grace' }))['new-dashboard']).toBe(true)
    expect((await service.resolve({ userId: 'linus' }))['new-dashboard']).toBe(false)
  })
})
```

To render a component with a flag set, boot a client app with the flags provider and render it with `renderWithKitr` from [testing](/packages/testing). The provider resolves at boot on the client, so the first render already has the value:

```tsx
// app/components/dashboard/dashboard-page.test.tsx
import { defineConfig, staticFlagsProvider } from '@kitr/flags'
import flagsProvider from '@kitr/flags/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { flags } from '#app/flags'
import { DashboardPage } from './dashboard-page'

// NewDashboard renders <h1>Your new dashboard</h1>.
it('shows the new dashboard when the flag is on', async () => {
  const app = await createTestApp({
    environment: 'client',
    providers: [flagsProvider],
    config: {
      flags: defineConfig({ definitions: flags, providers: [staticFlagsProvider({ 'new-dashboard': true })] }),
    },
  })
  renderWithKitr(<DashboardPage />, { app })
  expect(screen.getByRole('heading', { name: 'Your new dashboard' })).toBeTruthy()
})
```

Pass `environment: 'client'`. In the default `test` environment the provider does not resolve at boot, and the root app does not keep a resolved snapshot, as on the server.

To flip a flag mid-test, call `app.container.use('flags').hydrate({ 'new-dashboard': false })` inside `act()`; subscribed components re-render.

## Extend

A provider is an object with a `name`, an optional `init(context)` and `resolve(key, context)`:

| Member | Called | Returns |
| --- | --- | --- |
| `name` | In warnings | A label, such as `database`. |
| `init(context)` | Once per `resolve()`, before any key | Nothing. A throw skips the provider for this resolve. |
| `resolve(key, context)` | Once per declared flag | A value, or `undefined` for "no opinion". May be async. |

`init` is the place to load everything a provider needs for one context in a single request, so `resolve` can answer from memory. This provider reads per-team overrides that Acme's support staff publish as JSON at `https://flags.acme.com/teams/<teamId>.json`:

```ts
// app/flag_providers/team_overrides.ts
import type { FlagsProvider, FlagValue } from '@kitr/flags'

/** Overrides by team, from https://flags.acme.com/teams/<teamId>.json: { "new-dashboard": true }. */
export function teamOverridesProvider(baseUrl = 'https://flags.acme.com/teams'): FlagsProvider {
  const byTeam = new Map<string, Record<string, FlagValue>>()
  return {
    name: 'team-overrides',
    async init(context) {
      const teamId = context.teamId as string | undefined
      if (!teamId || byTeam.has(teamId)) return
      const response = await fetch(`${baseUrl}/${encodeURIComponent(teamId)}.json`)
      if (!response.ok) throw new Error(`flag overrides for ${teamId}: HTTP ${response.status}`)
      byTeam.set(teamId, (await response.json()) as Record<string, FlagValue>)
    },
    resolve(key, context) {
      const teamId = context.teamId as string | undefined
      return teamId ? byTeam.get(teamId)?.[key] : undefined
    },
  }
}
```

When the file can't be fetched, `init` throws, the provider is skipped for that resolve with a warning, and the next provider answers. This sketch keeps loaded teams for the life of the process; clear `byTeam` on a timer when overrides must change without a restart. Register the provider in priority order:

```ts
// config/flags.ts
import { defineConfig, envFlagsProvider, percentageFlagsProvider } from '@kitr/flags'
import { flags } from '#app/flags'
import { teamOverridesProvider } from '#app/flag_providers/team_overrides'

export default defineConfig({
  definitions: flags,
  providers: [envFlagsProvider(), teamOverridesProvider(), percentageFlagsProvider({ 'new-dashboard': 10 })],
})
```

The same config runs in the browser, which is why this provider uses `fetch` and an absolute URL rather than a database client. Keep server-only imports out of `config/flags.ts`. See [`FlagsProvider`](/packages/flags/api#flagsprovider) in the API reference.

## Devtools

When the [devtools](/packages/devtools) package is installed, every resolve or hydrate that updates the snapshot logs `resolved` with all values to the `flags` channel. It shows which values the browser booted with, and whether they came from the server's tag.

## Next steps

- [API reference](/packages/flags/api): every export with its signature.
- [OpenFeature](https://openfeature.dev/docs/reference/intro): the vendor-neutral flag standard the adapter speaks.
- [Auth](/packages/auth): the signed-in user whose id targets rollouts.
- [Cache](/packages/cache): remember slow server reads between requests.
- [Configuration](/docs/configuration): how `config/flags.ts` is loaded.
