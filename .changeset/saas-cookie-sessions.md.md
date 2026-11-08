---
'@kitr/kit-saas': minor
---

The saas kit signs in with cookie sessions instead of a bearer token in `localStorage`: `kitr add auth --provider session`, shield's CSRF, mail templates for email verification and password reset (with pages), two seeded demo users, and guarded pages that render on the server with the signed-in user's data (`ssrRoute(false)` is gone; the router dehydrates and hydrates the query cache).
