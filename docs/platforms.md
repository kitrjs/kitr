# Platforms

Where an app runs is a **platform**: a named entry in `kitrrc.ts` built by a factory from a platform package. The core knows only the contract (`definePlatform` in `@kitr/core`); each package owns its options, its scaffold, its dev server and its build.

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from 'kitr/web'
import { server } from 'kitr/server'
import { desktop } from 'kitr/desktop'

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
| `web` | `@kitr/web` | `web()` from `kitr/web` | A browser app through TanStack Start: `static` (prerendered pages), `spa`, or `ssr`. `pwa: true` adds the manifest and service worker. |
| `server` | `@kitr/server` | `server()` from `kitr/server` | The h3 server in `server/main.ts` on Node, Bun, Deno or Cloudflare Workers. |
| `desktop` | `@kitr/desktop` | `desktop()` from `kitr/desktop` | An Electron shell around the SPA build: Chromium ships with the app. Main and preload in `platforms/<name>/`. |
| `tauri` | `@kitr/tauri` | `tauri()` from `kitr/tauri` | A Tauri shell around the SPA build: a small Rust binary on the OS webview. Rust project in `platforms/<name>/src-tauri`. |
| `mobile` | `@kitr/mobile` | `mobile()` from `kitr/mobile` | A Capacitor shell for iOS and Android. Native project in `platforms/<name>/`. |

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

**web** (`@kitr/web`)

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `spa` | `static`: prerender every route to HTML. `spa`: one shell, client routing. `ssr`: render on request through TanStack Start. |
| `port` | `3000` | Dev and production port. |
| `host` | | Bind address (localhost in dev, `0.0.0.0` in production). |
| `pwa` | `false` | `true` or `{ name, shortName, themeColor, ... }`: web manifest, service worker (vite-plugin-pwa, autoUpdate), `useInstallPrompt`, `useServiceWorker` from `kitr/web/client`. |
| `base` | `/` | Public base path. |
| `open` | `false` | Open the browser on `kitr dev`. |

Prerendering, the sitemap and `robots.txt` come from `config/seo.ts` (`kitr add seo`).

**server** (`@kitr/server`)

| Option | Default | Description |
| --- | --- | --- |
| `runtime` | `node` | `node`, `bun`, `deno` or `workers` (Cloudflare, via `wrangler.toml`). |
| `port` | `3001` | |
| `host` | | |
| `entry` | `server/main.ts` | `createServer({...})` plus routes and realtime. A React project with a web platform also gets `app/routes/api.$.ts`, which mounts the same server inside TanStack Start. |

**desktop** (`@kitr/desktop`, Electron)

| Option | Default | Description |
| --- | --- | --- |
| `port` | `3200` | Dev server the window loads. |
| `title`, `width`, `height`, `minWidth`, `minHeight` | | Window. |
| `appId` | | Bundle identifier. |
| `devtools` | `true` | Open devtools in dev. |

electron-vite builds `platforms/<name>/{main,preload,ipc}.ts`; electron-builder packages installers. `kitr/desktop/client` has the typed IPC bridge (`createIpcClient`, `isElectron`), `kitr/desktop/main` and `kitr/desktop/preload` serve the other two processes, and `kitr/desktop/provider` registers the `platform` and `storage` drivers. Electron is the recommended desktop shell for most setups: it ships a browser with the app, so what you test is what every user runs.

**tauri** (`@kitr/tauri`)

Same options as `desktop`. The Rust project lives in `platforms/<name>/src-tauri` and needs the Rust toolchain; the window is the webview the operating system provides, so downloads are small but rendering can differ between machines. `kitr/tauri/client` has `isTauri`, `defineCommands`, `commandQuery`, `commandMutation`, `useTauriEvent` and `emitTauri`; `kitr/tauri/provider` registers the `platform` and `storage` drivers on the Tauri APIs and the store plugin. Pick one of `desktop` and `tauri` per project; neither installs the other's tooling.

**mobile** (`@kitr/mobile`)

| Option | Default | Description |
| --- | --- | --- |
| `targets` | `ios,android` | Native projects; `kitr dev`/`kitr build` run `cap add <target>` the first time and `--target ios` or `--target android` picks one. |
| `appId`, `appName` | | Bundle identifier and display name. |
| `scheme` | | Custom URL scheme for deep links. |
| `port` | `3100` | Dev server for live reload on the device. |

`kitr/mobile/provider` registers the Capacitor drivers; `kitr/platform/react` (`usePlatform`, `useAppState`, `useBackButton`, `useDeepLink`, `useSafeArea`) and `kitr/storage` then answer the same way in the browser and in the shell.

## Layout

```
app/                 # routes, components, features, channels: shared by every UI platform
server/
  main.ts            # the server platform entry (createServer + routes + realtime)
  routes.ts          # defineRoutes(...)
  controllers/
  realtime.ts        # createRealtimeServer({ channels })
config/              # one file per package (config/seo.ts, config/realtime.ts, config/theme.ts, ...)
platforms/
  app/               # desktop: the Electron main/preload sources; tauri: src-tauri/
  phone/             # mobile: capacitor.config.ts, ios/, android/
dist/<name>/         # build output per platform
kitrrc.ts
```

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

`ctx` carries the platform name, the project root, the resolved options, the package manager, the other platforms, the flags from the command line, an abort signal and `log`, `run` and `exec` helpers that resolve `node_modules/.bin`. `kitr/vite` reads `import.meta.env.KITR_PLATFORM` and `KITR_PLATFORM_TYPE` so app code can branch per platform at build time.
