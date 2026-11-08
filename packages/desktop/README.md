# @kitr/desktop

**Desktop.** Ship the same app to Windows, macOS and Linux in an Electron shell: Chromium ships with the app, so it renders the same everywhere.

```sh
pnpm kitr add desktop <name>
```

`kitr add` installs the package and wires it into your app: the provider in `kitrrc.ts`, its config file and its `AGENTS.md` section. Import it from `@kitr/desktop`.

Built on electron-vite, electron-builder.

Read the guide at https://kitr.dev/packages/desktop.

Part of [kitr](https://kitr.dev), the TypeScript framework where everything is an add-on. MIT licensed.
