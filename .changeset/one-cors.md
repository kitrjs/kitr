---
'@kitr/shield': minor
'@kitr/api': minor
---

`cors()` in `kitr/api` and `kitr/shield` is now one implementation. `kitr/shield` exports `corsPolicy(options)`, the rules independent of any framework, and both middlewares are thin wrappers over it with the same `CorsOptions` type (`origin` takes `'*'`, a single origin, a list or a predicate). `@kitr/api` depends on `@kitr/shield`. Differences from before: the api default for `headers` grows from `Content-Type, Authorization` to shield's `Content-Type, Authorization, X-CSRF-Token, X-Requested-With`, and shield now accepts a single origin string, which before matched by substring.
