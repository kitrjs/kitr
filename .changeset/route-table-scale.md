---
'@kitr/core': minor
'@kitr/router': minor
'@kitr/api': minor
'@kitr/realtime': patch
---

Route tables scale past a few dozen routes. Chaining `.page()`, `.layout()`, `.get()` and `.group()` no longer re-walks the accumulated route map on every step, so 300 pages, 300 endpoints or three merged tables of 100 keep exact types instead of failing with TS2589 and degrading to `any`. `RouteTable.merge()` now throws a `KitrError` naming a route that both tables register (it used to drop the second silently), and `use()` no longer writes through a `readonly` array. `createApiClient` decides "group or endpoint" from a lookup built once (and extended by `registerRoutes`), so property access is constant time.
