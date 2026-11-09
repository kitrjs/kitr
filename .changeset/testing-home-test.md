---
"@kitr/testing": patch
"@kitr/kit-saas": patch
"@kitr/kit-site": patch
---

`kitr add testing` writes a real first test. With the starter home page, `test/home.test.tsx` renders it with `renderWithKitr` inside the app's providers and checks its heading. A React project without that page gets a test that boots the app, and a server-only project keeps the `/api/health` test. The `saas` and `site` kits, which replace the starter page, drop the starter's test with it.
