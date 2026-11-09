---
"@kitr/cli": patch
---

`kitr doctor` no longer warns "kitr packages are on different versions: 0.3.1, ^0.3.1" in a fresh pnpm project. `kitr new` writes exact versions and pnpm saves a caret range for the packages it adds; both name the same release, so the check now compares versions rather than ranges.
