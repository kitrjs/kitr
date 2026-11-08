---
'@kitr/i18n': patch
---

`createI18n` now defaults `defaultNS` to `common` when a bundle has it, else the first namespace in `resources`, instead of i18next's `translation`. Without a `defaultNS`, `t('hello')` printed the key in every language.
