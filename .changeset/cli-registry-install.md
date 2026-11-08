---
"@kitr/cli": patch
---

`kitr new` and `kitr add <platform>` work when kitr was installed from a registry: the platform package is installed into the project before its setup module is loaded, the theme's component installer is found in the project, and a project that already has `@kitr/react` is no longer treated as server-only while its packages are being added. On Windows, the project's Biome shim (`biome.cmd`) is found, `kitr remove` lists leftover imports without needing `grep`, and the files kitr reports as written use `/` separators.
