---
title: Overview
description: Translate your app into several languages with typed keys.
order: 0
---

# Translations

Your first customers all read one language. Then a team in another country signs up, and every button, empty state and order total needs to read naturally in theirs too. Doing that late means hunting strings across the codebase, and doing it badly means a blank where a misspelt key should have been.

`@kitr/i18n` moves your interface text into one file per language, picks the visitor's language, and makes a wrong key a type error.

## What it is

`@kitr/i18n` is a translation provider for React. Strings live in one TypeScript file per language under `app/locales/`, components call `useTranslation()` and `t('orders.count', { count })`, and a `TranslationKeys` type generated from your default language makes every key checked. The provider detects the visitor's language from a saved choice or the browser, and `matchLocale()` does the same on the server from an `Accept-Language` header.

It runs in the browser, inside React. On the server you can call `createI18n()` or `matchLocale()` directly to translate an email or pick the language of a server-rendered page. It is for the strings in your code; marketing content in a CMS is a different job.

## Built on

`@kitr/i18n` is [react-i18next](https://react.i18next.com) and [i18next](https://www.i18next.com), re-exported unchanged. `useTranslation`, `Trans`, plurals, interpolation, formatting and namespaces work as their docs show.

kitr adds a provider with the defaults most apps want: an isolated i18next instance per app, the fallback language set to your default locale, no HTML escaping (React already escapes), no Suspense, and locale detection from a saved choice or the browser. It also adds `matchLocale()` for the server, `detectLocale()` for the client, and the `TranslationKeys` type for typed key props.

## Problems it solves

- **Strings scattered through components.** One file per language, split into namespaces, loaded by the provider. See [Organize strings into namespaces](/packages/i18n/guide#organize-strings-into-namespaces).
- **Plurals and formatting done by hand.** i18next handles `count`, and the Intl formatters handle numbers, money and dates per locale. See [Count things](/packages/i18n/guide#count-things) and [Format numbers, money and dates](/packages/i18n/guide#format-numbers-money-and-dates).
- **Misspelt keys that render blank.** `TranslationKeys` makes every key a compile-time check. See [Type your keys](/packages/i18n/guide#type-your-keys).
- **The wrong language on first render.** The server picks the locale from the request, so the HTML and the hydrated page agree. See [Choose the language on the server](/packages/i18n/guide#choose-the-language-on-the-server).
- **Every language shipped to every visitor.** Load a language's files when it is selected. See [Load a language on demand](/packages/i18n/guide#load-a-language-on-demand).

## Further reading

- [Guide](/packages/i18n/guide): install, configure and every task.
- [API reference](/packages/i18n/api): every export of `@kitr/i18n` and `@kitr/i18n/provider`.
- [react-i18next docs](https://react.i18next.com): `useTranslation`, `Trans` and the rest.
- [i18next docs](https://www.i18next.com): plurals, formatting, context and options.
- [Storage](/packages/storage): keep the visitor's language in a cookie the server can read.
