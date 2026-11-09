---
"@kitr/cli": patch
"@kitr/theme": patch
---

Fix the first run from a global install. `kitr new --kit site` (and every kit with a server platform) no longer skips the client packages as "server-only" when npm hoists `@kitr/react`. `kitr ui add`, and every kit that copies components, no longer fail with `Cannot find module '@kitr/cli'` when `kitr` runs through the global bin symlink.
