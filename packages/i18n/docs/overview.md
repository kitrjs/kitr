---
title: Overview
description: Translate your app into several languages with typed keys.
order: 0
---

# Translations

## What it is

`@kitr/i18n` is react-i18next with typed keys. Strings live in one file per language under `app/locales/`, components call `t('key')`, and a misspelt key is a type error. The provider picks the visitor's language from a saved choice or the browser.

Runs in the browser. On the server, `matchLocale()` picks a language from `Accept-Language`.

## Install

```sh
kitr add i18n
```

Adds `@kitr/i18n` with i18next and react-i18next, its provider, `config/i18n.ts` and `app/locales/en.ts`. [Every change](/packages/i18n/guide#install).

## Quick start

The generated English bundle holds one namespace:

```ts
// app/locales/en.ts
export default {
  common: {
    hello: 'Hello, {{name}}',
    save: 'Save',
  },
} as const
```

In a component, `useTranslation()` returns `t`, which looks a key up in the current language:

```tsx
// app/features/orders/welcome.tsx
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

`<Welcome name="Ada" />` renders "Hello, Ada" and a "Save" button. `t('helo')` is a type error. Next in the guide: [Translate your first string](/packages/i18n/guide#translate-your-first-string).

## Built on

kitr adds the provider with sensible defaults, `matchLocale()` for the server, `detectLocale()` for the client and the `TranslationKeys` type.

## Problems it solves

- **Strings scattered through components.** [Organize strings into namespaces](/packages/i18n/guide#organize-strings-into-namespaces).
- **Plurals and formatting done by hand.** [Count things](/packages/i18n/guide#count-things).
- **Misspelt keys that render blank.** [Type your keys](/packages/i18n/guide#type-your-keys).
- **The wrong language on first render.** [Choose the language on the server](/packages/i18n/guide#choose-the-language-on-the-server).
- **Every language shipped to every visitor.** [Load a language on demand](/packages/i18n/guide#load-a-language-on-demand).

## Further reading

- [Guide](/packages/i18n/guide).
- [API reference](/packages/i18n/api).
- [react-i18next docs](https://react.i18next.com).
- [i18next docs](https://www.i18next.com).
- [Storage](/packages/storage).
