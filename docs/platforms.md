# Platforms

Where an app runs is a **platform**: a named entry in `kitrrc.ts` built by a factory from a platform package. The contract is `definePlatform` in `@kitr/core`; each package owns its options, its scaffold, its dev server and its build.

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
| `web` | `@kitr/web` | `web()` | A browser app: static, single-page or server-rendered. |
| `server` | `@kitr/server` | `server()` | An API server on Node, Bun, Deno or Cloudflare Workers. |
| `desktop` | `@kitr/desktop` | `desktop()` | A desktop app in Electron, which ships its own browser. |
| `tauri` | `@kitr/tauri` | `tauri()` | A small desktop app in Tauri, on the system's webview. |
| `mobile` | `@kitr/mobile` | `mobile()` | An iOS and Android app in Capacitor. |

## Commands

| Command | What it does |
| --- | --- |
| `kitr dev [names...]` | Run every platform in development, or only the named ones: `kitr dev site`. |
| `kitr build [names...]` | Build for production into `dist/<name>/`. |
| `kitr start [names...]` | Serve the builds. |
| `kitr add <type> <name>` | Add a platform and the packages it needs: `kitr add web admin --mode spa`. |
| `kitr platforms` | List the platforms and their options. Subcommands: `types`, `scaffold <name>`, `remove <name>`. |
| `kitr config <name> [option] [value]` | Read or set one option: `kitr config site port 4000`. `--unset` removes it. |

Override any option at run time with an environment variable or a flag: `KITR_SITE_PORT=4000 kitr dev site` or `kitr dev site --port 4000`.

`kitr doctor` also checks each platform's tools, such as the Rust toolchain for Tauri.

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
| `pwa` | `false` | Make the app installable: `true`, or `{ name, shortName, themeColor }`. |
| `base` | `/` | Public base path. |
| `open` | `false` | Open the browser on `kitr dev`. |

Prerendering, the sitemap and `robots.txt` come from `config/seo.ts` (`kitr add seo`).

**server** (`@kitr/server`)

| Option | Default | Description |
| --- | --- | --- |
| `runtime` | `node` | `node`, `bun`, `deno` or `workers` (Cloudflare, via `wrangler.toml`). |
| `port` | `3001` | |
| `host` | | |
| `entry` | `server/main.ts` | The file that starts the server. |

**desktop** (`@kitr/desktop`, Electron)

| Option | Default | Description |
| --- | --- | --- |
| `port` | `3200` | Dev server the window loads. |
| `title`, `width`, `height`, `minWidth`, `minHeight` | | Window. |
| `appId` | | Bundle identifier. |
| `devtools` | `true` | Open devtools in dev. |

The Electron code lives in `platforms/<name>/`. Electron is the recommended desktop shell: it ships its own browser, so every user sees what you tested. See [desktop](/packages/desktop).

**tauri** (`@kitr/tauri`)

Same options as `desktop`. The Rust project lives in `platforms/<name>/src-tauri` and needs the Rust toolchain. Downloads are small, but the system webview can render differently between machines. Pick `desktop` or `tauri`, not both. See [tauri](/packages/tauri).

**mobile** (`@kitr/mobile`)

| Option | Default | Description |
| --- | --- | --- |
| `targets` | `ios,android` | Which native projects to create. `--target ios` picks one at run time. |
| `appId`, `appName` | | Bundle identifier and display name. |
| `scheme` | | Custom URL scheme for deep links. |
| `port` | `3100` | Dev server for live reload on the device. |

Hooks like `usePlatform()` and `useBackButton()` work the same in the browser and on the phone. See [mobile](/packages/mobile).

## Where the code runs: runtime, platform and form factor

Three separate questions, three APIs:

| Question | API | Values |
| --- | --- | --- |
| Which host am I in? | `detectRuntime()`, `useRuntime()` | `web`, `electron`, `tauri`, `capacitor` |
| What kind of place is it? | `platform.type`, `platform.os`, `platform.native`, `usePlatform()` | `web`, `desktop`, `mobile`, `server`; `macos`, `windows`, `linux`, `ios`, `android` |
| How big is the screen and what is the input? | `useFormFactor()` from `@kitr/platform/react` | `width` (`compact`, `medium`, `expanded`), `input` (`touch`, `pointer`), `orientation` |

What each environment answers. Electron and Tauri are both `type: 'desktop'`; only the runtime tells them apart.

| Environment | `runtime` | `type` | `native` | `os` | `useFormFactor()` before it can measure |
| --- | --- | --- | --- | --- | --- |
| Browser | `web` | `web` | `false` | from the user agent | `compact`, `touch` |
| Server rendering | `web` | `server` | `false` | `server` | `compact`, `touch` |
| Electron (`desktop()`) | `electron` | `desktop` | `true` | `macos`, `windows`, `linux` | `expanded`, `pointer` |
| Tauri (`tauri()`) | `tauri` | `desktop` | `true` | `macos`, `windows`, `linux` | `expanded`, `pointer` |
| Capacitor (`mobile()`) | `capacitor` | `mobile` | `true` | `ios`, `android` | `compact`, `touch` |

`detectRuntime()` only reads globals, so it is safe to call anywhere, including on the server.

### Device packages on each runtime

The five device packages (`native`, `notifications`, `files`, `secure-storage`, `updater`) pick a driver for the runtime they run in. When a native runtime has no driver, they throw `E_DRIVER_UNAVAILABLE` instead of quietly running browser code. Set `fallbackToWeb: true` in the package's config to use the browser driver anyway.

| Package | Browser | Electron (`desktop()`) | Tauri (`tauri()`) |
| --- | --- | --- | --- |
| `secure-storage` | AES-GCM in IndexedDB-keyed storage (`secure: false`) | `safeStorage`, ciphertext in `userData` (`secure: true`) | Stronghold snapshot, password in the OS keyring (`secure: true`) |
| `notifications` | Notification API, timers | Electron `Notification` in main, badge, click events | `plugin-notification`; scheduling by timer; taps on mobile only |
| `files` | File System Access or `<input type="file">` | `dialog` and `fs/promises` on dialog-chosen paths, `path` set | `plugin-dialog` and `plugin-fs`, `path` set |
| `updater` | Service worker | `electron-updater` | `plugin-updater` and `plugin-process` |
| `native` | Web APIs per capability | Clipboard, Touch ID, `system` (theme, power, online, `openExternal`) | Clipboard, `system` (theme, online, `openExternal`) |

`kitr add <package>` installs the plugins each of your platforms needs. On Capacitor:

| Package | Capacitor driver | Plugins | Caveats |
| --- | --- | --- | --- |
| `native` | clipboard, share, haptics, geolocation | `@capacitor/clipboard`, `share`, `haptics`, `geolocation` | `camera` and `biometrics` are `supported: false`; sharing `File` objects is not possible |
| `notifications` | OS-scheduled local notifications, Android channels; `capacitorPush()` for FCM and APNs | `@capacitor/local-notifications`, `push-notifications` | Push needs Firebase config on Android and the Push capability on iOS |
| `files` | System picker; `save()` goes through the cache and the share sheet; `capacitorFileStore()` | `@capawesome/capacitor-file-picker`, `@capacitor/filesystem`, `@capacitor/share` | No "save as" dialog on mobile |
| `secure-storage` | Keychain and Keystore | `@aparajita/capacitor-secure-storage` | The Keychain survives an uninstall on iOS |
| `updater` | Play in-app updates on Android, the App Store page on iOS | `@capawesome/capacitor-app-update` | Play offers updates only to builds installed from Play |

A missing plugin throws `E_DRIVER_UNAVAILABLE` with the plugin to install.

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

`ctx` has the platform name, the project root, the options, the command-line flags and `log`, `run` and `exec` helpers.

A shell around the web build (like Electron, Tauri or Capacitor) can reuse the shared steps: `shellPlatformHooks()` from `@kitr/platform/cli` for dev, build and doctor, and `createShellProvider()` from `@kitr/platform/shell` for the runtime drivers. `desktop`, `tauri` and `mobile` are built this way.
