---
"@kitr/i18n": patch
"kitr": patch
"@kitr/cli": patch
---

The i18n provider moves to `@kitr/i18n/provider` (`kitr/i18n/provider`), like every other package's provider. Lazy-importing the `kitr/i18n` entry itself from `kitrrc.ts` made the SSR bundle lose the `react-i18next` re-exports, so `useTranslation` was undefined when the server rendered. `kitr add i18n` writes the new path; change `() => import('@kitr/i18n')` to `() => import('@kitr/i18n/provider')` in an existing app.
