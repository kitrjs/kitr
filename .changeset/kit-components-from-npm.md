---
"@kitr/cli": patch
---

`kitr new` with a kit that pulls components (app, dashboard, saas, tauri and the others built on them) works again from a CLI installed from npm. It failed with "@kitr/theme is not available to this CLI" although the kit had just installed @kitr/theme, because Node's resolver had cached the package's manifest from earlier in the run. The CLI now reads the installed manifest from disk to find `@kitr/theme/commands`.
