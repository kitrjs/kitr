---
"@kitr/vite": patch
"@kitr/cli": patch
"@kitr/core": patch
---

Importing a `kitr/<name>` entry whose `@kitr/<name>` is not installed now stops dev and build with "kitr/<name> re-exports @kitr/<name>, which is not installed. Run `kitr add <name>`." instead of a misleading missing-export error or an error thrown in the browser. `kitr doctor` reports the same.
