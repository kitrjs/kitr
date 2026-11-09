---
"@kitr/cli": patch
"@kitr/web": patch
"@kitr/server": patch
"@kitr/desktop": patch
"@kitr/tauri": patch
"@kitr/mobile": patch
---

A platform package's `kitr` block can carry a `platform` object: its label, tagline, targets, shell, colour, highlights, a code snippet, the commands that run it and links to upstream docs. `@kitr/web`, `@kitr/server`, `@kitr/desktop`, `@kitr/tauri` and `@kitr/mobile` ship theirs, so kitr.dev's /platforms pages read the text from the packages. `kitr package:check` validates the object and names each broken field.
