---
title: Translations
description: Translate your app into several languages with typed keys.
order: 1
---

# Translations

`kitr/i18n` is [react-i18next](https://react.i18next.com), re-exported unchanged, set up the way most apps want it. Strings live in one file per language, the visitor's language is picked automatically, and a missing key is a type error instead of a blank on the screen.

## Install

```sh
kitr add i18n
```

This installs `@kitr/i18n`, `i18next` and `react-i18next`, adds `@kitr/i18n/provider` to `kitrrc.ts` and writes `app/locales/en.ts` and `config/i18n.ts`.

## Write strings

```ts
// app/locales/en.ts
export default {
  common: {
    hello: 'Hello, {{name}}',
    save: 'Save',
  },
  projects: {
    empty: 'No projects yet',
    count_one: '{{count}} project',
    count_other: '{{count}} projects',
  },
} as const
```

Each top-level key is a namespace. Add a language by copying the file, translating it and listing it in the config:

```ts
// config/i18n.ts
import { defineConfig } from 'kitr/i18n'
import de from '#app/locales/de'
import en from '#app/locales/en'

export default defineConfig({
  resources: { en, de },
  defaultLocale: 'en',
  defaultNS: 'common',
})
```

| Option | Default | Description |
| --- | --- | --- |
| `resources` | required | Every language's strings, keyed by locale. |
| `defaultLocale` | required | Used when nothing better matches, and for missing keys. |
| `locales` | the keys of `resources` | The locales the app supports. |
| `detect` | `true` | Pick the locale from a saved choice, then the browser's languages. |
| `storageKey` | `locale` | Where an explicit choice is saved. |

Any other [i18next option](https://www.i18next.com/overview/configuration-options) passes straight through.

## Use them

```tsx
import { useTranslation } from 'kitr/i18n'

function Greeting({ name }: { name: string }) {
  const { t } = useTranslation()
  return <h1>{t('hello', { name })}</h1>
}

function ProjectCount({ count }: { count: number }) {
  const { t } = useTranslation('projects')
  return <p>{count ? t('count', { count }) : t('empty')}</p>
}
```

## Typed keys

Tell i18next the shape of your English strings once, and `t()` autocompletes every key and rejects typos:

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

## Switching language

```tsx
const { i18n } = useTranslation()
i18n.changeLanguage('de')
```

To remember the choice across visits, save it under the `storageKey`. With [storage](/packages/storage), a `locale` cookie also lets the server render the right language on the first request. On the server, `matchLocale(request.headers.get('accept-language'), ['en', 'de'])` picks the best match from the browser's header.
