---
"@kitr/cli": patch
---

`kitr catalog` lists the official packages, platforms and kits; `kitr catalog --json` prints each with its whole `kitr` block, platforms with their `platform` text, so a site's build step can read them. `@kitr/cli` exports `KitrCatalog`, `KitrCatalogEntry`, `KitrPlatformInfo`, `KitrCategory`, `categories`, `kitManifests`, `validateManifest` and `buildCatalog` to type and build that output.
