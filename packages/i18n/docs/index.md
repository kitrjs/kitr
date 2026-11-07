---
title: I18n
description: Translate your app into several languages with typed keys.
order: 1
---

# I18n

[react-i18next](https://react.i18next.com) with the setup done: resources from `app/locales`, locale detection from the browser or the `Accept-Language` header on the server, a remembered choice, and key types derived from your default locale so `t('common.hello')` fails to compile when the key is missing.

## Install

```sh
kitr add i18n
```

```ts
// config/i18n.ts
import { defineConfig } from 'kitr/i18n'
import en from '#app/locales/en'
import fr from '#app/locales/fr'

export default defineConfig({
  resources: { en, fr },
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  detect: true, // navigator.language on the client, Accept-Language on the server
  storageKey: 'locale', // query param, cookie and storage key for an explicit choice
})
```

```ts
// app/locales/en.ts
export default { common: { hello: 'Hello {{name}}', save: 'Save' } }
```

## In a component

```tsx
import { useTranslation } from 'kitr/i18n'

function Greeting({ name }: { name: string }) {
  const { t, i18n } = useTranslation()
  return (
    <>
      <p>{t('common.hello', { name })}</p>
      <button onClick={() => i18n.changeLanguage('fr')}>Français</button>
    </>
  )
}
```

`TranslationKeys<typeof en>` is the union of dotted keys; declare it once in `app/i18n.d.ts` and `t()` becomes typed.

## Server rendering

The provider picks the locale per request from the cookie, then `Accept-Language`, and renders with it, so the HTML already matches the visitor. `matchLocale(header, supported)` and `detectLocale(supported)` are exported for custom flows.
