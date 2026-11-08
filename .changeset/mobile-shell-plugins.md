---
"@kitr/mobile": patch
"@kitr/kit-mobile": minor
"@kitr/cli": patch
---

`kitr dev|build` for the mobile platform now find the app's Capacitor plugins. `cap` reads plugins from the `package.json` of the folder it runs in, which for `platforms/<name>/` had none, so `cap add` failed and no plugin reached the native projects. kitr writes a generated `platforms/<name>/package.json` listing the app's dependencies before each `cap` command. `kitr new --kit mobile` installs the Capacitor plugins the device packages use, and the CLI pins their versions.
