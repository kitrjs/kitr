---
'@kitr/api': patch
---

`createApiClient` echoes the CSRF cookie in a header on writes (`kitr-csrf` to `x-csrf-token` by default), so it works with shield's CSRF and cookie sessions. Set `csrf: false` to turn it off or pass `{ cookie, header }` to rename them.
