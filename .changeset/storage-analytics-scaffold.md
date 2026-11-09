---
"@kitr/storage": patch
"@kitr/analytics": patch
"@kitr/kit-saas": patch
---

`kitr add` no longer writes demo values into real files. `kitr add storage` writes `app/storage.ts` with only `localeCookie` and a commented `defineStorage` example. `kitr add analytics` writes an empty `AppEvents` in `app/analytics.ts` with two events as a comment, and `config/analytics.ts` now templates the cookieless Plausible adapter first (`VITE_PLAUSIBLE_DOMAIN`, optional `VITE_PLAUSIBLE_HOST`) and Google Analytics second (`VITE_GA_MEASUREMENT_ID`), all three declared in `app/env.ts`. With the consent package installed, the config says analytics is held until the visitor accepts. The `saas` kit declares the events its pages track.
