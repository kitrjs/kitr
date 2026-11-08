# Platforms

Where an app runs is a **platform**: a named entry in `kitrrc.ts` built by a factory from a platform package. The core knows only the contract (`definePlatform` in `@kitr/core`); each package owns its options, its scaffold, its dev server and its build.

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from '@kitr/web'
import { server } from '@kitr/server'
import { desktop } from '@kitr/desktop'

export default defineKitrConfig({
  platforms: {
    site: web({ mode: 'ssr', pwa: true }),
    api: server({ runtime: 'node', port: 3001 }),
    app: desktop({ title: 'My App' }),
  },
  packages: [...],
  providers: [...],
})
```

Names are yours. One project can hold several platforms of the same type (`admin: web({...})`, `www: web({...})`), and every command addresses them by name.

| Type | Package | Factory | What it builds |
| --- | --- | --- | --- |
| `web` | `@kitr/web` | `web()` from `@kitr/web` | A browser app through TanStack Start: `static` (prerendered pages), `spa`, or `ssr`. `pwa: true` adds the manifest and service worker. |
| `server` | `@kitr/server` | `server()` from `@kitr/server` | The h3 server in `server/main.ts` on Node, Bun, Deno or Cloudflare Workers. |
| `desktop` | `@kitr/desktop` | `desktop()` from `@kitr/desktop` | An Electron shell around the SPA build: Chromium ships with the app. Main and preload in `platforms/<name>/`. |
| `tauri` | `@kitr/tauri` | `tauri()` from `@kitr/tauri` | A Tauri shell around the SPA build: a small Rust binary on the OS webview. Rust project in `platforms/<name>/src-tauri`. |
| `mobile` | `@kitr/mobile` | `mobile()` from `@kitr/mobile` | A Capacitor shell for iOS and Android. Native project in `platforms/<name>/`. |

## Commands

| Command | What it does |
| --- | --- |
| `kitr dev [names...]` | Starts every platform (or the named ones) in parallel: Vite for `web`, `tsx watch` / `bun --watch` / `wrangler dev` for `server`, the Electron window for `desktop`, the Tauri window for `tauri`, Capacitor live reload for `mobile`. |
| `kitr build [names...]` | Production builds, in order. Web platforms land in `dist/<name>/` (`client/` and, for SSR, `server/server.js`). |
| `kitr start [names...]` | Serves the builds: srvx for SSR and static sites, the compiled server for `server`. |
| `kitr add <type> <name> [--option value]` | Adds a platform: installs the package, writes `platforms.<name>` into `kitrrc.ts`, adds the packages the platform needs (`router` for `web`, `router platform storage` for `desktop`, `tauri` and `mobile`, `server` for `server`), scaffolds its files and the `dev`/`build`/`start` scripts. `kitr add web admin --mode spa --port 3002`. |
| `kitr platforms` | Lists the platforms and their effective options. `kitr platforms types` lists the available types, `kitr platforms scaffold <name>` rewrites a platform's files, `kitr platforms remove <name>` takes it out of `kitrrc.ts`. |
| `kitr config <name> [option] [value]` | Reads or sets one option in `kitrrc.ts`, validated against the platform's option schema: `kitr config site port 4000`, `kitr config api runtime bun`, `kitr config site pwa --unset`. |

Every option can be overridden at run time without touching the file: `KITR_SITE_PORT=4000 kitr dev site`, or `kitr dev site --port 4000`. The name is upper-cased with non-alphanumerics turned into `_`.

`kitr doctor` runs each platform's own checks (the Rust toolchain for Tauri, Xcode and Android Studio for Capacitor, `wrangler` for Workers).

## Options

Every platform takes `without`, whatever its type:

| Option | Default | Description |
| --- | --- | --- |
| `without` | `[]` | Packages left out of this build: their provider and their `config/<name>.ts`. See [Leave a package out](#leave-a-package-out). |

**web** (`@kitr/web`)

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `spa` | `static`: prerender every route to HTML. `spa`: one shell, client routing. `ssr`: render on request through TanStack Start. |
| `port` | `3000` | Dev and production port. |
| `host` | | Bind address (localhost in dev, `0.0.0.0` in production). |
| `pwa` | `false` | `true` or `{ name, shortName, themeColor, ... }`: web manifest, service worker (vite-plugin-pwa, autoUpdate), `useInstallPrompt`, `useServiceWorker` from `@kitr/web/client`. |
| `base` | `/` | Public base path. |
| `open` | `false` | Open the browser on `kitr dev`. |

Prerendering, the sitemap and `robots.txt` come from `config/seo.ts` (`kitr add seo`).

**server** (`@kitr/server`)

| Option | Default | Description |
| --- | --- | --- |
| `runtime` | `node` | `node`, `bun`, `deno` or `workers` (Cloudflare, via `wrangler.toml`). |
| `port` | `3001` | |
| `host` | | |
| `entry` | `server/main.ts` | `createServer({ providers, config, routes })` with the table from `server/routes.ts`. A React project with a web platform also gets `app/server.ts`, Start's server entry, which hands the table's paths to the same server inside the Start process. |

**desktop** (`@kitr/desktop`, Electron)

| Option | Default | Description |
| --- | --- | --- |
| `port` | `3200` | Dev server the window loads. |
| `title`, `width`, `height`, `minWidth`, `minHeight` | | Window. |
| `appId` | | Bundle identifier. |
| `devtools` | `true` | Open devtools in dev. |

electron-vite builds `platforms/<name>/{main,preload,ipc}.ts`; electron-builder packages installers. `@kitr/desktop/client` has the typed IPC bridge (`createIpcClient`, `isElectron`), `@kitr/desktop/main` and `@kitr/desktop/preload` serve the other two processes, and `@kitr/desktop/provider` registers the `platform` and `storage` drivers. Electron is the recommended desktop shell for most setups: it ships a browser with the app, so what you test is what every user runs.

**tauri** (`@kitr/tauri`)

Same options as `desktop`. The Rust project lives in `platforms/<name>/src-tauri` and needs the Rust toolchain; the window is the webview the operating system provides, so downloads are small but rendering can differ between machines. `@kitr/tauri/client` has `isTauri`, `defineCommands`, `commandQuery`, `commandMutation`, `useTauriEvent` and `emitTauri`; `@kitr/tauri/provider` registers the `platform` and `storage` drivers on the Tauri APIs and the store plugin. Pick one of `desktop` and `tauri` per project; neither installs the other's tooling.

**mobile** (`@kitr/mobile`)

| Option | Default | Description |
| --- | --- | --- |
| `targets` | `ios,android` | Native projects; `kitr dev`/`kitr build` run `cap add <target>` the first time and `--target ios` or `--target android` picks one. |
| `appId`, `appName` | | Bundle identifier and display name. |
| `scheme` | | Custom URL scheme for deep links. |
| `port` | `3100` | Dev server for live reload on the device. |

`@kitr/mobile/provider` registers the Capacitor drivers; `@kitr/platform/react` (`usePlatform`, `useAppState`, `useBackButton`, `useDeepLink`, `useSafeArea`) and `@kitr/storage` then answer the same way in the browser and in the shell.

## Where the code runs: runtime, platform and form factor

Three questions have three answers, kept apart on purpose:

| Question | API | Values |
| --- | --- | --- |
| Which host am I in? | `detectRuntime()` from `@kitr/platform`; `platform.runtime` and `useRuntime()` from `@kitr/platform/react` | `web`, `electron`, `tauri`, `capacitor` |
| What kind of place is it? | `platform.type`, `platform.os`, `platform.native`, `usePlatform()` | `web`, `desktop`, `mobile`, `server`; `macos`, `windows`, `linux`, `ios`, `android` |
| How big is the screen and what is the input? | `useFormFactor()` from `@kitr/platform/react` | `width` (`compact`, `medium`, `expanded`), `input` (`touch`, `pointer`), `orientation` |

The matrix below is what each environment answers. `desktop()` and `tauri()` both report `type: 'desktop'`; only the runtime tells Electron from Tauri.

| Environment | `runtime` | `type` | `native` | `os` | `useFormFactor()` before it can measure |
| --- | --- | --- | --- | --- | --- |
| Browser | `web` | `web` | `false` | from the user agent | `compact`, `touch` |
| Server rendering | `web` | `server` | `false` | `server` | `compact`, `touch` |
| Electron (`desktop()`) | `electron` | `desktop` | `true` | `macos`, `windows`, `linux` | `expanded`, `pointer` |
| Tauri (`tauri()`) | `tauri` | `desktop` | `true` | `macos`, `windows`, `linux` | `expanded`, `pointer` |
| Capacitor (`mobile()`) | `capacitor` | `mobile` | `true` | `ios`, `android` | `compact`, `touch` |

`detectRuntime()` reads globals only, so it is safe anywhere: Tauri by `window.__TAURI_INTERNALS__`, Capacitor by `Capacitor.isNativePlatform()`, Electron by the preload bridge (`kitrIpc`), `process.versions.electron` or an `Electron/` user agent, and everything else is `web`. The `platform` service reports the runtime its shell provider registered, and falls back to `detectRuntime()` for a driver that does not say. `isElectron()`, `isTauri()` and `isCapacitor()` in each platform's `client` entry are `detectRuntime()` comparisons.

The five device packages (`native`, `notifications`, `files`, `secure-storage`, `updater`) pick their driver by `platform.runtime`: a driver in the config, else one a provider registered, else `selectDriver(runtime)`. The web runtime gets the browser driver (a memory driver on the server). A native runtime gets its own driver, and where that driver is missing `selectDriver()` throws a `KitrError` with code `E_DRIVER_UNAVAILABLE` naming the runtime and the package, instead of quietly running browser code in the webview. Electron and Tauri have all five; the matrix below says what each uses. Set `fallbackToWeb: true` in the package's `config/<name>.ts` to keep the webview behaviour on purpose.

| Package | Browser | Electron (`desktop()`) | Tauri (`tauri()`) |
| --- | --- | --- | --- |
| `secure-storage` | AES-GCM in IndexedDB-keyed storage (`secure: false`) | `safeStorage`, ciphertext in `userData` (`secure: true`) | Stronghold snapshot, password in the OS keyring (`secure: true`) |
| `notifications` | Notification API, timers | Electron `Notification` in main, badge, click events | `plugin-notification`; scheduling by timer; taps on mobile only |
| `files` | File System Access or `<input type="file">` | `dialog` and `fs/promises` on dialog-chosen paths, `path` set | `plugin-dialog` and `plugin-fs`, `path` set |
| `updater` | Service worker | `electron-updater` | `plugin-updater` and `plugin-process` |
| `native` | Web APIs per capability | Clipboard, Touch ID, `system` (theme, power, online, `openExternal`) | Clipboard, `system` (theme, online, `openExternal`) |

The Electron drivers need `handleKitrIpc()` in main and `exposeIpc()` in the preload script; the Tauri drivers need the plugin packages, crates and permissions the Tauri scaffold writes. Electron's `electron-updater` is an optional peer, and the Tauri plugins are optional peers that `kitr add tauri` installs. `kitr add <package>` installs the peers for the platforms a project has.

What the Capacitor runtime (`mobile()`) gets, with each plugin an optional peer dependency that `kitr add` installs and the driver imports on first use:

| Package | Capacitor driver | Plugins | Caveats |
| --- | --- | --- | --- |
| `native` | clipboard, share, haptics, geolocation | `@capacitor/clipboard`, `share`, `haptics`, `geolocation` | `camera` and `biometrics` are `supported: false`; sharing `File` objects is not possible |
| `notifications` | OS-scheduled local notifications, Android channels; `capacitorPush()` for FCM and APNs | `@capacitor/local-notifications`, `push-notifications` | Push needs Firebase config on Android and the Push capability on iOS |
| `files` | System picker; `save()` goes through the cache and the share sheet; `capacitorFileStore()` | `@capawesome/capacitor-file-picker`, `@capacitor/filesystem`, `@capacitor/share` | No "save as" dialog on mobile |
| `secure-storage` | Keychain and Keystore | `@aparajita/capacitor-secure-storage` | The Keychain survives an uninstall on iOS |
| `updater` | Play in-app updates on Android, the App Store page on iOS | `@capawesome/capacitor-app-update` | Play offers updates only to builds installed from Play |

A plugin that is not installed rejects with `E_DRIVER_UNAVAILABLE` and `install <plugin>`; nothing falls back to the webview. Electron and Tauri keep throwing until their drivers land.

## One project, every platform

[`examples/everywhere`](https://github.com/kitrjs/kitr/tree/main/examples/everywhere) is one project with a website, an Electron app and a Capacitor app:

```ts
// kitrrc.ts
platforms: {
  site: web({ mode: 'spa' }),
  app: desktop(),
  phone: mobile(),
},
```

It is the `app` kit plus `kitr add desktop app`, `kitr add mobile phone`, `kitr add secure-storage` and `kitr add notifications`. Add the platforms first, so the device packages see Capacitor and install its plugins.

| Command | What it does |
| --- | --- |
| `kitr dev` | Runs every platform. Each line of output starts with `[site]`, `[app]` or `[phone]`. Each platform has its own port. |
| `kitr dev app` | Runs one. |
| `kitr build site` | Builds one. `kitr build app` also packs the Electron app. `kitr build phone` also runs `cap sync`. |

Branch on the shell in code:

```ts
import { detectRuntime } from '@kitr/platform'

if (detectRuntime() === 'electron') {
  // Electron only. In components, use useRuntime().
}
if (import.meta.env.KITR_PLATFORM === 'phone') {
  // Only in the build of the platform named phone. Other builds drop this branch.
}
```

Use the runtime for what the shell can do. Use `KITR_PLATFORM` for what to ship. To add your own state or a different driver, see [Extending kitr](/docs/extending).

## Layout

```
app/                 # routes, components, features, channels: shared by every UI platform
server/
  main.ts            # the server platform entry (createServer + routes + realtime)
  routes.ts          # defineRoutes(...)
  controllers/
  realtime.ts        # createRealtimeServer({ channels })
config/              # one file per package (config/seo.ts, config/realtime.ts, config/theme.ts, ...)
  <platform>/        # files that replace a shared one for one platform's build
platforms/
  app/               # desktop: the Electron main/preload sources; tauri: src-tauri/
  phone/             # mobile: capacitor.config.ts, ios/, android/
dist/<name>/         # build output per platform
kitrrc.ts
```

## One project, several apps

A site, an admin, an API, a phone app and a desktop app can be one project or several. Pick by what they share:

| Use | When |
| --- | --- |
| Platforms in one `kitrrc.ts` | The apps share code, packages and their versions, and ship together. |
| A workspace (`kitr.workspace.ts`) | The apps need different package versions, release dates or teams. |

With platforms, each build can differ in three ways: its config files, the packages it leaves out, and its pages.

### Config per platform

A file in `config/<platform>/` replaces the shared file of the same name, for that platform's build only:

```
config/
  theme.ts         # every build
  flags.ts
  admin/
    theme.ts       # the admin build uses this instead of config/theme.ts
  phone/
    flags.ts
```

The file replaces the shared one. Nothing is merged. To change a few keys, spread the shared file:

```ts
// config/admin/theme.ts
import { defineConfig } from '@kitr/theme'
import base from '../theme'

export default defineConfig({ ...base, default: 'dark' })
```

The folder name must be a platform name; `kitr doctor` warns about any other folder in `config/`. `kitr platforms` lists the config files each platform uses and where each comes from. For a one-line difference, `forPlatform()` inside the shared file is enough.

### Leave a package out

`without` takes packages out of one build. Name them as in `packages`, with or without `@kitr/`:

```ts
platforms: {
  www: web({ mode: 'ssr' }),
  admin: web({ mode: 'spa', port: 3002, without: ['analytics', 'consent'] }),
  phone: mobile({ without: ['analytics'] }),
},
```

That build has neither the package's provider nor its `config/<name>.ts`, so `app.container.has('analytics')` is false there. `kitr config admin without analytics,consent` sets it. A name that is not in `packages` is a `kitr doctor` error. A service only one platform needs is a provider that returns early unless `app.platform` is that platform.

### Flags per platform

Keep one flags service and split the definitions into groups:

```ts
// app/flags/mobile.ts
export const mobileFlags = defineFlags({ 'offline-sync': { default: false } })

// app/flags/desktop.ts
export const desktopFlags = defineFlags({ 'menu-bar': { default: true } })

// app/flags.ts: shared code imports this one
export const flags = { ...mobileFlags, ...desktopFlags }
```

`config/flags.ts` lists `flags`, so the web and server builds see every flag. `config/phone/flags.ts` lists `mobileFlags` and `config/desk/flags.ts` lists `desktopFlags`. Each file can also use its own providers.

### Theme per platform

`config/admin/theme.ts` spreads the shared theme and changes `default`, `colors` or `tokens`. Styles in `app/styles/` stay shared. Two versions of a package in one project are not possible; that is a workspace.

### Pages per platform

| Need | Tool |
| --- | --- |
| Some pages differ | `platforms: ['admin']` on the page or its group. |
| A whole different tree | Two tables, `app/routes.ts` and `app/admin/routes.ts`. In `app/router.tsx`, `import.meta.env.KITR_PLATFORM === 'admin' ? adminRoutes : routes` drops the other tree from the bundle. |
| A page that must not render elsewhere, even when linked | `beforeLoad: onlyPlatform('admin')` from `@kitr/router`. |

The rest of the toolbox works per platform too: `ssrRoute({ www: true, default: false })` in `@kitr/seo`, `forPlatform()` and `perPlatform()` in `@kitr/platform`, `<Only>`, `<Except>` and `useFormFactor()` in `@kitr/platform/react`, and the stacks in `@kitr/router/stack`. For apps in separate projects, see [Workspaces](cli.md#workspaces).

## Writing a platform package

```ts
import { definePlatform } from 'kitr/app'

export const kiosk = definePlatform<{ port?: number }>(
  {
    type: 'kiosk',
    description: 'Fullscreen Chromium on a Raspberry Pi',
    describe: { port: { type: 'number', default: 3300, description: 'Dev server port' } },
    requires: ['router', 'platform'],       // packages `kitr add kiosk <name>` adds first
    provider: '@acme/kitr-kiosk/provider',  // registered in kitrrc.ts providers
  },
  (options) => ({
    dependencies: { chromium: '^1.0.0' },
    async scaffold(ctx) { await ctx.write('kiosk.json', '{}') },
    async dev(ctx) { await ctx.exec('vite', ['--port', String(options.port)]) },
    async build(ctx) { await ctx.exec('vite', ['build', '--outDir', ctx.dir('dist')]) },
    async start(ctx) { await ctx.exec('chromium', ['--kiosk', `http://localhost:${options.port}`]) },
    async doctor(ctx) { return [] },
    agents: 'Run `kitr dev kiosk` and open the window on the Pi.',
  }),
)
```

A shell platform (Electron, Tauri, Capacitor or your own) does not have to write the skeleton again: `shellPlatformHooks()` from `@kitr/platform/cli` runs the sequence every shell shares (dev server, wait for it, launch the shell; client build, shell build; dependency, file and tool checks in `doctor`) and takes the parts that differ, and `createShellProvider()` from `@kitr/platform/shell` does the same for the runtime half (detect the shell, register the `platform` driver and the shell's other drivers, log the runtime to devtools). `desktop`, `tauri` and `mobile` are thin configurations of both.

`ctx` carries the platform name, the project root, the resolved options, the package manager, the other platforms, the flags from the command line, an abort signal and `log`, `run` and `exec` helpers that resolve `node_modules/.bin`. `@kitr/vite` reads `import.meta.env.KITR_PLATFORM` and `KITR_PLATFORM_TYPE` so app code can branch per platform at build time.
