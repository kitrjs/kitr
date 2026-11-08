---
title: Translations
description: Translate your app into several languages with typed keys.
order: 1
---

# Translations

Acme's first customers all read English. Then a team in Berlin signs up, and every button, empty state and order total needs to read naturally in German too. `@kitr/i18n` moves your interface text into one file per language, picks the visitor's language automatically, and makes a misspelled key a type error.

> [!SUMMARY]
> Translations with typed keys and automatic language detection, built on react-i18next. Add it with `kitr add i18n`; the overview is at [/packages/i18n](/packages/i18n).

It is [react-i18next](https://react.i18next.com) and [i18next](https://www.i18next.com), re-exported unchanged, with a provider and sensible defaults: the fallback language is your default locale, there is no HTML escaping (React already escapes) and no Suspense. It adds `matchLocale()` for `Accept-Language` headers and a `TranslationKeys` type for typed key props.

The provider runs in the browser, inside React. On the server you can still call `createI18n()` or `matchLocale()` directly, to translate an email or pick a page's language.

The examples translate Acme's order screens at `app.acme.com` into English and German.

## Install

```sh
kitr add i18n
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Adds `@kitr/i18n`, `i18next` and `react-i18next` to `dependencies` and installs them. Pass `--no-install` to skip the install.
- Adds `() => import('@kitr/i18n/provider')` to `providers` and `'@kitr/i18n'` to `packages` in `kitrrc.ts`. The provider binds `i18n` in the container and wraps your app in react-i18next's `I18nextProvider`.
- Writes `app/locales/en.ts` with a `common` namespace holding `hello` and `save`, unless the file exists.
- Writes `config/i18n.ts`, unless it exists. See [Configure](#configure).
- Adds a `## kitr: i18n` section to `AGENTS.md`: strings live in `app/locales/<lang>.ts`, components call `const { t } = useTranslation()` from `@kitr/i18n`, and keys are typed from the English bundle.

The `site` kit includes i18n with English and German bundles, a language switch, and the visitor's choice in a cookie so server-rendered pages arrive in the right language.

`kitr remove i18n` takes the provider and the package out of `kitrrc.ts`, deletes `config/i18n.ts`, removes the three dependencies and the `AGENTS.md` section, then lists files that still import `@kitr/i18n`. It leaves `app/locales/` in place.

</details>

> [!WARNING] Client packages only
> `kitr add i18n` skips a server-only project with a warning.

## Configure

`kitr add i18n` writes this file:

```ts
// config/i18n.ts
import { defineConfig } from '@kitr/i18n'
import en from '#app/locales/en'

export default defineConfig({
  resources: { en },
  defaultLocale: 'en',
  defaultNS: 'common',
})
```

| Option | Default | Description |
| --- | --- | --- |
| `resources` | required | Every locale's strings, keyed by locale then namespace: `{ en: { common: { ... } } }`. |
| `defaultLocale` | required | The language used when nothing better matches, and the fallback for any key missing in another language. |
| `locales` | the keys of `resources` | The languages the app supports. A language outside this list is never chosen, even when you call `changeLanguage()` with it. |
| `detect` | `true` | In the browser, choose the language from the saved choice under `storageKey`, then from the browser's languages. `false` always starts in `defaultLocale`. |
| `storageKey` | `'locale'` | The `localStorage` key detection reads for a saved choice. |
| `defaultNS` | `'common'` when a bundle has it, else the first namespace in `resources` | The namespace `t('save')` looks in when the key names none. |

Any other [i18next option](https://www.i18next.com/overview/configuration-options) passes straight through, and wins over kitr's defaults:

| i18next option | kitr's default | Why |
| --- | --- | --- |
| `fallbackLng` | `defaultLocale` | A German page with a missing key shows the English string, not the key. |
| `supportedLngs` | `locales` | Only languages you ship are chosen. |
| `interpolation.escapeValue` | `false` | React escapes text already; escaping twice shows `&lt;`. |
| `react.useSuspense` | `false` | Bundles are in memory, so there is nothing to wait for. |

> [!WARNING] interpolation replaces kitr's object
> Include `escapeValue: false` in it when you add other interpolation options.

## Translate your first string

The generated `app/locales/en.ts` holds one namespace, `common`:

```ts
// app/locales/en.ts
export default {
  common: {
    hello: 'Hello, {{name}}',
    save: 'Save',
  },
} as const
```

In a component, `useTranslation()` from `@kitr/i18n` returns `t`, which looks a key up in the current language:

```tsx
// app/components/orders/welcome.tsx
import { useTranslation } from '@kitr/i18n'

export function Welcome({ name }: { name: string }) {
  const { t } = useTranslation()
  return (
    <section>
      <h2>{t('hello', { name })}</h2>
      <button type="submit">{t('save')}</button>
    </section>
  )
}
```

`<Welcome name="Ada" />` renders "Hello, Ada" and a "Save" button. `as const` keeps the exact strings, which [typed keys](#type-your-keys) need.

## Organize strings into namespaces

Each top-level key in a bundle is a namespace. Keep `common` for words used everywhere and give each feature its own:

```ts
// app/locales/en.ts
export default {
  common: {
    hello: 'Hello, {{name}}',
    save: 'Save',
    cancel: 'Cancel',
  },
  orders: {
    title: 'Orders',
    empty: 'No orders yet',
    status: { open: 'Open', paid: 'Paid', refunded: 'Refunded' },
  },
} as const
```

Pass a namespace to `useTranslation` to make it the default for that component. Reach another namespace with a `namespace:` prefix, and nested keys with dots:

```tsx
// app/components/orders/orders-header.tsx
import { useTranslation } from '@kitr/i18n'

export function OrdersHeader() {
  const { t } = useTranslation('orders')
  return (
    <header>
      <h1>{t('title')}</h1>
      <span>{t('status.open')}</span>
      <button type="button">{t('common:cancel')}</button>
    </header>
  )
}
```

For one branch, `useTranslation('orders', { keyPrefix: 'status' })` lets you write `t('paid')` for `orders.status.paid`.

## Insert values

Put a placeholder in double braces and pass the value under the same name:

```tsx
// app/components/orders/assigned-to.tsx
import { useTranslation } from '@kitr/i18n'

export function AssignedTo({ order }: { order: { id: string; owner: string } }) {
  const { t } = useTranslation('orders')
  // orders.assigned: 'Order {{id}} is assigned to {{owner}}'
  return <p>{t('assigned', { id: order.id, owner: order.owner })}</p>
  // => Order 1001 is assigned to Grace
}
```

> [!WARNING] Values are not HTML-escaped
> Rendered as React text that is safe. Never pass a translated string to `dangerouslySetInnerHTML`; use [Trans](#put-markup-inside-a-string) for markup.

## Count things

Give a key one variant per plural form and pass `count`. i18next picks the form for the current language:

```ts
// app/locales/en.ts
export default {
  orders: {
    count_zero: 'No orders',
    count_one: '{{count}} order',
    count_other: '{{count}} orders',
  },
} as const
```

```tsx
// app/components/orders/order-count.tsx
import { useTranslation } from '@kitr/i18n'

export function OrderCount({ count }: { count: number }) {
  const { t } = useTranslation('orders')
  return <p>{t('count', { count })}</p>
}
// count 0 => No orders
// count 1 => 1 order
// count 3 => 3 orders
```

Ask for `count`, never `count_one`. `_zero` is optional. Other languages need other forms, such as Polish `_few` and `_many`; see the [i18next plural guide](https://www.i18next.com/translation-function/plurals).

## Format numbers, money and dates

Name a formatter after the value inside the braces. It uses `Intl` with the current language, so one key prints `€1,234.50` in English and `1.234,50 €` in German:

```ts
// app/locales/en.ts
export default {
  orders: {
    total: 'Total: {{amount, currency(EUR)}}',
    placed: 'Placed on {{date, datetime}}',
    items: '{{count, number}} items',
  },
} as const
```

```tsx
// app/components/orders/order-summary.tsx
import { useTranslation } from '@kitr/i18n'

export function OrderSummary({ order }: { order: { total: number; placedAt: Date } }) {
  const { t } = useTranslation('orders')
  return (
    <dl>
      <dd>{t('total', { amount: order.total })}</dd>
      <dd>{t('placed', { date: order.placedAt })}</dd>
    </dl>
  )
}
// en, total 1234.5 => Total: €1,234.50
// de, total 1234.5 => Summe: 1.234,50 €
// de, placedAt 2026-03-01 => Bestellt am 1.3.2026
```

The formatters are `number`, `currency`, `datetime`, `relativetime` and `list`, each taking `Intl` options in parentheses; see [i18next formatting](https://www.i18next.com/translation-function/formatting). Pass raw numbers and `Date` objects to `t`; don't format them first.

## Put markup inside a string

A sentence with a link or bold words can't be split without breaking word order in other languages. Keep it as one string with named tags and render it with `Trans`:

```ts
// app/locales/en.ts
export default {
  common: {
    welcome: 'Welcome back, <bold>{{name}}</bold>. <link>See your orders</link>.',
  },
} as const
```

```tsx
// app/components/orders/welcome-back.tsx
import { Trans } from '@kitr/i18n'

export function WelcomeBack({ name }: { name: string }) {
  return (
    <p>
      <Trans
        i18nKey="common:welcome"
        values={{ name }}
        components={{ bold: <strong />, link: <a href="https://app.acme.com/orders" /> }}
      />
    </p>
  )
}
```

The German bundle can move the tags anywhere in its sentence. [Trans in react-i18next's docs](https://react.i18next.com/latest/trans-component) covers the other forms.

## Add a language

Copy the English bundle, translate it, and list it in the config. Typing the copy against the English one makes a missing key fail the type check:

```ts
// app/locales/en.ts
const en = {
  common: { hello: 'Hello, {{name}}', save: 'Save' },
  orders: { title: 'Orders', empty: 'No orders yet' },
} as const

export default en

/** The shape every other locale must match: same keys, any strings. */
export type Bundle<T> = { [K in keyof T]: T[K] extends string ? string : Bundle<T[K]> }
```

```ts
// app/locales/de.ts
import type { Bundle } from './en'
import type en from './en'

const de = {
  common: { hello: 'Hallo, {{name}}', save: 'Speichern' },
  orders: { title: 'Bestellungen', empty: 'Noch keine Bestellungen' },
} as const satisfies Bundle<typeof en>

export default de
```

```ts
// config/i18n.ts
import { defineConfig } from '@kitr/i18n'
import de from '#app/locales/de'
import en from '#app/locales/en'

export default defineConfig({
  resources: { en, de },
  defaultLocale: 'en',
  defaultNS: 'common',
})
```

A key missing from `de.ts` is a type error, and at run time a German page shows the English string. Plural keys are the exception: a language may need forms English lacks, so loosen `Bundle` for those namespaces.

## Type your keys

Tell i18next the shape of the English bundle once, and `t()` autocompletes every key and rejects typos at compile time:

```ts
// app/i18n.d.ts
import type en from '#app/locales/en'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: typeof en
  }
}
```

```tsx
// app/components/orders/orders-header.tsx
import { useTranslation } from '@kitr/i18n'

export function OrdersHeader() {
  const { t } = useTranslation('orders')
  return <h1>{t('titel')}</h1>
  // Type error: 'titel' is not a key of the orders namespace
}
```

When a component takes a key as a prop, type it with `TranslationKeys`, which flattens a namespace into dotted key paths:

```tsx
// app/components/orders/status-badge.tsx
import { type TranslationKeys, useTranslation } from '@kitr/i18n'
import type en from '#app/locales/en'

type OrderKey = TranslationKeys<(typeof en)['orders']>
// => 'title' | 'empty' | 'status.open' | 'status.paid' | 'status.refunded'

export function StatusBadge({ label }: { label: OrderKey }) {
  const { t } = useTranslation('orders')
  return <span className="badge">{t(label)}</span>
}
```

> [!WARNING] Pass one namespace
> `TranslationKeys<typeof en>` over the whole bundle gives `'common.hello'`, not the `common:hello` form `t()` expects.

## Switch the language

`i18n.changeLanguage()` switches every mounted component. Save the choice under `storageKey` so detection finds it next visit:

```tsx
// app/components/language-switch.tsx
import { useTranslation } from '@kitr/i18n'

const languages = { en: 'English', de: 'Deutsch' } as const

export function LanguageSwitch() {
  const { i18n } = useTranslation()
  return (
    <select
      value={i18n.resolvedLanguage}
      onChange={(event) => {
        const next = event.target.value
        localStorage.setItem('locale', next)
        void i18n.changeLanguage(next)
      }}
    >
      {Object.entries(languages).map(([code, label]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  )
}
```

`changeLanguage` writes neither `localStorage` nor `<html lang>`. Keep `<html lang>` in sync for screen readers by listening once at startup:

```ts
// app/client.tsx
import { app } from './app'

app.boot().then(() => {
  const i18n = app.container.use('i18n')
  document.documentElement.lang = i18n.language
  i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language
  })
  // ... then hydrate or render as before
})
```

A language outside `locales` is never chosen: `changeLanguage('fr')` without a French bundle stays on `en`.

## Detect the visitor's language

With `detect: true`, the provider picks the first language in this order:

1. `app.env.locale`, when the app was created with one.
2. The saved choice in `localStorage` under `storageKey`, when it is a supported language.
3. The browser's `navigator.languages`, matched against your languages.
4. `defaultLocale`.

Matching tries each browser language in order: an exact match wins, then the base language (`en-GB` matches `en`), and a base matches a regional bundle (`pt` matches `pt-BR`). `detectLocale(supported, storageKey)` runs steps 2 and 3 alone:

```ts
// app/lib/settings/language.ts
import { detectLocale } from '@kitr/i18n'

detectLocale(['en', 'de'])
// navigator.languages ['de-AT', 'en'] and nothing saved => 'de'
// localStorage locale = 'en' => 'en'
// on the server => undefined
```

Detection runs once at startup. Use `detect: false` when the server decides the language.

## Choose the language on the server

On the server the `Accept-Language` header carries the visitor's preference. `matchLocale()` parses it and returns the best supported language:

```ts
// server/controllers/locale-controller.ts
import type { HttpContext } from '@kitr/api'
import { matchLocale } from '@kitr/i18n'

export default class LocaleController {
  async show({ request }: HttpContext) {
    const header = request.header('accept-language') ?? ''
    return { locale: matchLocale(header, ['en', 'de']) ?? 'en' }
  }
}
```

With `['en', 'de']` supported:

| `Accept-Language` | Result |
| --- | --- |
| `de-CH,de;q=0.9,en;q=0.8` | `'de'` |
| `en-GB` | `'en'` |
| `fr-FR,fr;q=0.9` | `undefined` |
| `''` | `undefined` |

It reads languages in header order and does not sort by `q`; browsers already send them in preference order. It also takes an array such as `navigator.languages`. A server-rendered app usually stores the choice in a cookie so server and browser agree; the `site` kit does this with [storage](/packages/storage)'s `defineCookie`.

## Translate outside components

The provider binds the instance as `i18n` in the container. Read it where there are no hooks, such as a toast after a mutation:

```ts
// app/lib/orders/notify.ts
import type { KitrApp } from '@kitr/kitr/app'

export function orderSavedMessage(app: KitrApp, orderId: string) {
  const i18n = app.container.use('i18n')
  return i18n.t('orders:saved', { id: orderId })
  // en => Order 1001 saved
}
```

For an email in the customer's language, create an instance from the same config and take a fixed `t` per language:

```ts
// server/mail/order-confirmation.ts
import { createI18n } from '@kitr/i18n'
import i18nConfig from '#config/i18n'

const i18n = createI18n({ ...i18nConfig, detect: false })

export function confirmationSubject(locale: string, count: number) {
  const t = i18n.getFixedT(locale, 'orders')
  return t('count', { count })
}
// confirmationSubject('de', 2) => 2 Bestellungen
```

> [!WARNING] Don't change language on a shared instance
> An instance you create at module level is shared by every request, so `changeLanguage()` would switch the language under requests still rendering. Use `getFixedT`, or `i18n.cloneInstance({ lng })` for a per-request copy.

## Load a language on demand

Every bundle in `resources` ships in the main JavaScript bundle. Load rarely used languages when chosen, and list them in `locales` up front:

```ts
// app/lib/settings/load-language.ts
import type { KitrApp } from '@kitr/kitr/app'

export async function useFrench(app: KitrApp) {
  const i18n = app.container.use('i18n')
  const { default: fr } = await import('#app/locales/fr')
  for (const [namespace, strings] of Object.entries(fr)) {
    i18n.addResourceBundle('fr', namespace, strings)
  }
  await i18n.changeLanguage('fr')
}
```

```ts
// config/i18n.ts
import { defineConfig } from '@kitr/i18n'
import de from '#app/locales/de'
import en from '#app/locales/en'

export default defineConfig({
  resources: { en, de },
  locales: ['en', 'de', 'fr'],
  defaultLocale: 'en',
  defaultNS: 'common',
})
```

Without `fr` in `locales`, `changeLanguage('fr')` stays on English. To load every language over HTTP, see i18next [backend plugins](https://www.i18next.com/overview/plugins-and-utils#backends).

## Handle missing keys

A key missing in German shows the English string. A key that exists nowhere shows the key itself, without its namespace:

```ts
// app/lib/orders/missing.ts
import type { KitrApp } from '@kitr/kitr/app'

export function demo(app: KitrApp) {
  const i18n = app.container.use('i18n')
  i18n.t('orders:refundNote')
  // => 'refundNote' when no bundle has it
}
```

Typed keys catch this at compile time. To report missing keys at run time, pass i18next's `saveMissing` and `missingKeyHandler` in `config/i18n.ts`.

## Testing

Render translated components with [testing](/packages/testing)'s `createTestApp` and `renderWithKitr`. Use `detect: false` so the runner's browser language doesn't decide the result, and `env: { locale }` to render another language:

```tsx
// app/components/orders/orders-header.test.tsx
import { screen } from '@testing-library/react'
import { useTranslation } from '@kitr/i18n'
import i18nProvider from '@kitr/i18n/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { describe, expect, it } from 'vitest'
import i18nConfig from '#config/i18n'

function OrdersHeader({ count, total }: { count: number; total: number }) {
  const { t } = useTranslation('orders')
  return (
    <header>
      <h1>{t('title')}</h1>
      <p>{t('count', { count })}</p>
      <p>{t('total', { amount: total })}</p>
    </header>
  )
}

const boot = (locale?: string) =>
  createTestApp({
    providers: [i18nProvider],
    config: { i18n: { ...i18nConfig, detect: false } },
    env: locale ? { locale } : {},
  })

describe('OrdersHeader', () => {
  it('renders in English by default', async () => {
    renderWithKitr(<OrdersHeader count={3} total={1234.5} />, { app: await boot() })

    expect(screen.getByRole('heading', { name: 'Orders' })).toBeTruthy()
    expect(screen.getByText('3 orders')).toBeTruthy()
    expect(screen.getByText('Total: €1,234.50')).toBeTruthy()
  })

  it('renders in German', async () => {
    renderWithKitr(<OrdersHeader count={1} total={1234.5} />, { app: await boot('de') })

    expect(screen.getByRole('heading', { name: 'Bestellungen' })).toBeTruthy()
    expect(screen.getByText('1 Bestellung')).toBeTruthy()
    expect(screen.getByText('Summe: 1.234,50 €')).toBeTruthy()
  })
})
```

To test plain functions that call `t`, skip React and use `createI18n(i18nConfig, 'de').t(...)`.

## Next steps

- [API reference](/packages/i18n/api): every export of `@kitr/i18n` and `@kitr/i18n/provider`.
- [Storage](/packages/storage): keep the visitor's language in a cookie the server can read.
- [i18next docs](https://www.i18next.com): plurals, formatting, context and options.
