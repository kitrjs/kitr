---
"@kitr/router": patch
---

`.root()` takes `{ lazy: () => import('./pages/not-found') }` for `notFoundComponent`, `errorComponent` and `pendingComponent`, the way `.page()` takes `lazy`, so the fallback screens stay out of the first bundle. A plain component still works.
