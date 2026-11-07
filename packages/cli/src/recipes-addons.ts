import type { Recipe } from './recipes'

const r = (recipe: Recipe) => recipe

/** `@acme/my-app` → `My App`: what users see in window titles, manifests and installers. */
export function displayName(pkgName: string | undefined): string {
  const base = (pkgName ?? 'app')
    .replace(/^@[^/]+\//, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
  return base ? base.replace(/\b\w/g, (c) => c.toUpperCase()) : 'App'
}

/**
 * Platform and observability add-ons: analytics, error monitoring, PWA, Electron, Tauri, Capacitor.
 * Each one wires the basics (deps, config, scripts, scaffold) and leaves the vendor tooling in charge.
 */
export const addonRecipes: Record<string, Recipe> = {
  analytics: r({
    name: 'analytics',
    package: '@kitr/analytics',
    client: true,
    description:
      'page/track/identify behind one API: Google Analytics, Plausible, PostHog or console; page views from the router.',
    configure(ctx, c) {
      c.installPackages(['@kitr/analytics'])
      c.addProvider('@kitr/analytics/provider')
      c.addPackage('@kitr/analytics')
      c.addEnvSchema('public', 'VITE_GA_MEASUREMENT_ID', 'e.string({ optional: true })', '')
      ctx.write(
        'config/analytics.ts',
        `import { defineConfig, googleAnalytics } from 'kitr/analytics'
import { env } from '#app/env'

/**
 * With no adapters, development logs every event to the console and production sends nothing,
 * so the app works before any vendor is chosen.
 */
export default defineConfig({
  adapters: [
    ...(env.VITE_GA_MEASUREMENT_ID
      ? [googleAnalytics({ measurementId: env.VITE_GA_MEASUREMENT_ID })]
      : []),
    // plausible({ domain: 'example.com' }),
    // posthog(posthogJs, { apiKey: env.VITE_POSTHOG_KEY }),   // pnpm add posthog-js
  ],
  // Consent banners: start queued, then call analytics.enable() once the user agrees.
  // enabled: false,
  globalProps: { app: env.VITE_APP_NAME },
})
`,
      )
      ctx.write(
        'app/analytics.ts',
        `import type { EventMap } from 'kitr/analytics'

/** Every event the app sends, with its props. \`useAnalytics<AppEvents>()\` checks names and props. */
export interface AppEvents extends EventMap {
  'sign-in.completed': { method: 'password' | 'oauth' }
  'project.created': { id: string }
}
`,
      )
      c.addAgentsSection(
        'analytics',
        `- Track from components with \`const analytics = useAnalytics<AppEvents>()\` (\`kitr/analytics/react\`) then \`analytics.track('project.created', { id })\`; declare new events in \`app/analytics.ts\` first.\n- Page views are sent automatically on every route change. \`analytics.identify(user.id, traits)\` after sign-in, \`analytics.reset()\` on sign-out.\n- Adapters live in \`config/analytics.ts\`; never call gtag/posthog directly.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/analytics/provider')
      c.removePackage('@kitr/analytics')
      c.removePackages(['@kitr/analytics'])
      c.removeAgentsSection('analytics')
    },
  }),
  monitoring: r({
    name: 'monitoring',
    package: '@kitr/monitoring',
    description:
      'captureException, breadcrumbs and user context behind one API (Sentry or console), an error boundary and server middleware.',
    configure(ctx, c) {
      const serverOnly = ctx.isServerOnly()
      c.installPackages(['@kitr/monitoring'])
      if (!serverOnly) c.addProvider('@kitr/monitoring/provider')
      c.addPackage('@kitr/monitoring')
      if (serverOnly) {
        c.addEnv({ SENTRY_DSN: '' }, 'Monitoring')
        ctx.write(
          'config/monitoring.ts',
          `import { defineConfig } from 'kitr/monitoring'

/** Reporters: development prints to the console, production sends nowhere until one is added. */
export default defineConfig({
  reporters: [
    // import * as Sentry from '@sentry/node'  (pnpm add @sentry/node)
    // ...(process.env.SENTRY_DSN ? [sentry(Sentry, { dsn: process.env.SENTRY_DSN })] : []),
  ],
  tags: { service: '${ctx.pkg.name ?? 'app'}' },
})
`,
        )
      } else {
        c.addEnvSchema('public', 'VITE_SENTRY_DSN', 'e.string({ optional: true })', '')
        ctx.write(
          'config/monitoring.ts',
          `import { defineConfig } from 'kitr/monitoring'
import { env } from '#app/env'

/**
 * Reporters: development prints to the console, production sends nowhere until one is added.
 * Pass the SDK module so the right flavour (react, browser, node) is bundled for the environment.
 */
export default defineConfig({
  reporters: [
    // import * as Sentry from '@sentry/react'  (pnpm add @sentry/react)
    // ...(env.VITE_SENTRY_DSN ? [sentry(Sentry, { dsn: env.VITE_SENTRY_DSN })] : []),
  ],
  // shouldReport: (error) => !(error instanceof KitrError && error.status < 500),
  tags: { app: env.VITE_APP_NAME },
})
`,
        )
      }
      c.addAgentsSection(
        'monitoring',
        serverOnly
          ? `- \`server.use(reportErrors(monitoring))\` from \`kitr/monitoring/server\` reports every thrown error with method, url and request id before kitr's error handler answers.\n- Elsewhere: \`app.container.use('monitoring').captureException(error, { extra })\`; \`addBreadcrumb\` before risky steps. Reporters live in \`config/monitoring.ts\`.`
          : `- Unhandled errors, rejections and render errors are reported automatically (window handlers + the error boundary the provider wraps). For caught errors: \`useService('monitoring').captureException(error, { extra })\`.\n- \`monitoring.setUser({ id })\` after sign-in, \`setUser(null)\` on sign-out; \`addBreadcrumb({ category, message })\` before risky steps.\n- Expected failures (kitr 4xx, aborted requests) are dropped by default; tune \`shouldReport\` in \`config/monitoring.ts\`. On the server: \`server.use(reportErrors(monitoring))\` from \`kitr/monitoring/server\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/monitoring/provider')
      c.removePackage('@kitr/monitoring')
      c.removePackages(['@kitr/monitoring'])
      c.removeAgentsSection('monitoring')
    },
  }),
  pwa: r({
    name: 'pwa',
    package: '@kitr/pwa',
    client: true,
    description:
      'Installable app: manifest and service worker via vite-plugin-pwa, with useInstallPrompt/useOnline/useServiceWorker hooks.',
    configure(ctx, c) {
      c.installPackages(['@kitr/pwa', { name: 'vite-plugin-pwa', dev: true }])
      c.addPackage('@kitr/pwa')
      const name = displayName(ctx.pkg.name)
      ctx.write(
        'config/pwa.ts',
        `import { defineConfig } from 'kitr/pwa'

/** Read by \`kitrPwa()\` in vite.config.ts (the manifest) and by the app (hooks). */
export default defineConfig({
  name: '${name}',
  shortName: '${name.slice(0, 12)}',
  description: '${name}',
  themeColor: '#0f172a',
  backgroundColor: '#ffffff',
  display: 'standalone',
  // 'prompt' (default) lets useServiceWorker() show an "update available" banner; 'autoUpdate' reloads.
  registerType: 'prompt',
})
`,
      )
      ctx.write(
        'public/icons/README.md',
        `Put \`icon-192.png\` (192x192) and \`icon-512.png\` (512x512, maskable-safe) here; the manifest in config/pwa.ts points at them.\n`,
      )
      ctx.write(
        'app/components/pwa-update.tsx',
        `import { useServiceWorker } from 'kitr/pwa'

/** Registers the service worker and shows a one-line banner when a new version is waiting. */
export function PwaUpdate() {
  const sw = useServiceWorker()
  if (!sw.needRefresh) return null
  return (
    <div role="status" style={{ position: 'fixed', bottom: 16, right: 16, padding: 12, borderRadius: 8, background: '#0f172a', color: '#fff' }}>
      A new version is available.{' '}
      <button type="button" onClick={() => sw.update()} style={{ textDecoration: 'underline' }}>
        Reload
      </button>
    </div>
  )
}
`,
      )
      c.addImport('vite.config.ts', 'pwa', './config/pwa')
      c.addVitePlugin('kitrPwa', 'kitr/pwa/vite', 'kitrPwa(pwa)')
      c.addAgentsSection(
        'pwa',
        `- The manifest and worker come from \`config/pwa.ts\` through \`kitrPwa(pwa)\` in vite.config.ts; the worker is only emitted by \`vite build\` (set \`devEnabled: true\` to test it in dev).\n- Render \`<PwaUpdate />\` (app/components/pwa-update.tsx) once in the root route so updates are offered. \`useInstallPrompt()\` gives an install button; \`useOnline()\` for offline UI.\n- \`/api/*\` and \`/ws\` are never served from the cache.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/pwa')
      c.removePackages(['@kitr/pwa', 'vite-plugin-pwa'])
      c.removeAgentsSection('pwa')
    },
  }),
  electron: r({
    name: 'electron',
    package: '@kitr/electron',
    client: true,
    description:
      'Desktop app with Electron: electron-vite for main/preload/renderer, a typed IPC schema, secure window defaults, electron-builder packaging.',
    configure(ctx, c) {
      const name = displayName(ctx.pkg.name)
      c.installPackages([
        '@kitr/electron',
        { name: 'electron', dev: true },
        { name: 'electron-vite', dev: true },
        { name: 'electron-builder', dev: true },
      ])
      c.addPackage('@kitr/electron')
      c.setPackageField('main', 'out/main/index.js')
      c.addScript('electron:dev', 'electron-vite dev')
      c.addScript('electron:build', 'electron-vite build && electron-builder')
      c.addScript('electron:preview', 'electron-vite preview')
      ctx.write(
        'config/electron.ts',
        `import { defineConfig } from 'kitr/electron'

export default defineConfig({
  window: { width: 1200, height: 800, minWidth: 800, minHeight: 600, title: '${name}' },
  devtools: true,
})
`,
      )
      ctx.write(
        'electron/ipc.ts',
        `/**
 * The IPC contract shared by main, preload and the renderer. Add a command here, implement it
 * in electron/main.ts, call it from the app with \`ipc.invoke('...')\`.
 */
export type Ipc = {
  'app.version': () => string
  'dialog.openFile': (filters?: Array<{ name: string; extensions: string[] }>) => string | null
}

/** Events pushed from main to the renderer. */
export type IpcPush = {
  'app.focus': (focused: boolean) => void
}
`,
      )
      ctx.write(
        'electron/main.ts',
        `import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { createIpcEmitter, createMainWindow, handleIpc } from 'kitr/electron/main'
import electronConfig from '../config/electron'
import type { Ipc, IpcPush } from './ipc'

const push = createIpcEmitter<IpcPush>(() => BrowserWindow.getAllWindows()[0]?.webContents)

handleIpc<Ipc>(ipcMain, {
  'app.version': () => app.getVersion(),
  'dialog.openFile': async (_event, filters) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  },
})

app.whenReady().then(async () => {
  const win = await createMainWindow({ ...electronConfig.window, devtools: electronConfig.devtools })
  win.on('focus', () => push.emit('app.focus', true))
  win.on('blur', () => push.emit('app.focus', false))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow(electronConfig.window)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
`,
      )
      ctx.write(
        'electron/preload.ts',
        `import { contextBridge, ipcRenderer } from 'electron'
import { exposeIpc } from 'kitr/electron/preload'

// Only the channels declared in electron/ipc.ts reach the renderer; everything else stays in main.
exposeIpc(contextBridge, ipcRenderer)
`,
      )
      ctx.write(
        'app/ipc.ts',
        `import { createIpcClient } from 'kitr/electron'
import type { Ipc, IpcPush } from '../electron/ipc'

/** Typed renderer-side client. \`ipc.available\` is false in a plain browser, so the web build still runs. */
export const ipc = createIpcClient<Ipc, IpcPush>()
`,
      )
      ctx.write(
        'electron.vite.config.ts',
        `import { kitr } from 'kitr/vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'electron/main.ts' } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'electron/preload.ts' } },
  },
  renderer: {
    // The kitr app as-is: same routes, providers and config as the web build.
    root: '.',
    plugins: [kitr()],
    build: { rollupOptions: { input: 'index.html' } },
  },
})
`,
      )
      ctx.write(
        'electron-builder.yml',
        `appId: com.example.${name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'}
productName: ${name}
directories:
  output: release
files:
  - out/**
mac:
  category: public.app-category.productivity
win:
  target: nsis
linux:
  target: AppImage
`,
      )
      c.addAgentsSection(
        'electron',
        `- \`pnpm electron:dev\` runs main + preload + the renderer (the normal kitr app) with HMR; \`pnpm electron:build\` packages with electron-builder (see electron-builder.yml).\n- IPC is typed end to end: declare in \`electron/ipc.ts\`, implement in \`electron/main.ts\` (\`handleIpc\`), call from the app via \`ipc.invoke('app.version')\` from \`app/ipc.ts\`. Guard desktop-only UI with \`ipc.available\` / \`isElectron()\`.\n- Windows keep context isolation and the sandbox on; never enable nodeIntegration. Electron targets the SPA layout (\`kitr new --kit app\`): the renderer loads index.html, not the Start server.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/electron')
      c.removePackages(['@kitr/electron', 'electron', 'electron-vite', 'electron-builder'])
      c.removeAgentsSection('electron')
    },
  }),
  tauri: r({
    name: 'tauri',
    package: '@kitr/tauri',
    client: true,
    description:
      'Desktop and mobile with Tauri 2: src-tauri scaffold, Vite tuned for the webview, typed Rust commands and events.',
    configure(ctx, c) {
      const name = displayName(ctx.pkg.name)
      const crate =
        name
          .replace(/[^a-z0-9]+/gi, '_')
          .toLowerCase()
          .replace(/^_+|_+$/g, '') || 'app'
      c.installPackages(['@kitr/tauri', '@tauri-apps/api', { name: '@tauri-apps/cli', dev: true }])
      c.addPackage('@kitr/tauri')
      c.addScript('tauri', 'tauri')
      c.addScript('tauri:dev', 'tauri dev')
      c.addScript('tauri:build', 'tauri build')
      ctx.write(
        'config/tauri.ts',
        `import { defineConfig } from 'kitr/tauri'

/** The kitr() Vite plugin reads this: fixed port, strictPort, TAURI_ENV_* exposed, no clearScreen. */
export default defineConfig({
  devPort: 1420,
})
`,
      )
      ctx.write(
        'app/commands.ts',
        `import { defineCommands } from 'kitr/tauri'

/** Mirrors the \`#[tauri::command]\` functions in src-tauri/src/lib.rs. */
export type Commands = {
  greet: (args: { name: string }) => string
}

/** \`await commands.greet({ name })\`: typed, and a no-op-safe \`isTauri()\` check is yours to add for web builds. */
export const commands = defineCommands<Commands>()
`,
      )
      ctx.write(
        'src-tauri/tauri.conf.json',
        `${JSON.stringify(
          {
            $schema: 'https://schema.tauri.app/config/2',
            productName: name,
            version: ctx.pkg.version ?? '0.1.0',
            identifier: `com.example.${crate.replace(/_/g, '')}`,
            build: {
              frontendDist: '../dist',
              devUrl: 'http://localhost:1420',
              beforeDevCommand: `${ctx.pm} dev`,
              beforeBuildCommand: `${ctx.pm} build`,
            },
            app: {
              windows: [{ title: name, width: 1200, height: 800, minWidth: 800, minHeight: 600 }],
              security: { csp: null },
            },
            bundle: {
              active: true,
              targets: 'all',
              icon: [
                'icons/32x32.png',
                'icons/128x128.png',
                'icons/128x128@2x.png',
                'icons/icon.icns',
                'icons/icon.ico',
              ],
            },
          },
          null,
          2,
        )}\n`,
      )
      ctx.write(
        'src-tauri/Cargo.toml',
        `[package]
name = "${crate}"
version = "${ctx.pkg.version ?? '0.1.0'}"
edition = "2021"

[lib]
name = "${crate}_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
`,
      )
      ctx.write('src-tauri/build.rs', 'fn main() {\n    tauri_build::build()\n}\n')
      ctx.write(
        'src-tauri/src/main.rs',
        `// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ${crate}_lib::run()
}
`,
      )
      ctx.write(
        'src-tauri/src/lib.rs',
        `/// Called from the app as \`commands.greet({ name })\` (app/commands.ts).
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`,
      )
      ctx.write(
        'src-tauri/capabilities/default.json',
        `${JSON.stringify(
          {
            $schema: '../gen/schemas/desktop-schema.json',
            identifier: 'default',
            description: 'Capabilities for the main window',
            windows: ['main'],
            permissions: ['core:default'],
          },
          null,
          2,
        )}\n`,
      )
      ctx.write('src-tauri/.gitignore', '/target\n/gen/schemas\n')
      ctx.write(
        'src-tauri/icons/README.md',
        'Run `pnpm tauri icon path/to/icon.png` (1024x1024) to generate every size listed in tauri.conf.json.\n',
      )
      c.addAgentsSection(
        'tauri',
        `- \`pnpm tauri:dev\` starts Vite on :1420 and the native window; \`pnpm tauri:build\` bundles installers. Rust lives in \`src-tauri/\` (needs the Rust toolchain; mobile: \`pnpm tauri ios init\`).\n- Commands: add \`#[tauri::command]\` in src-tauri/src/lib.rs, register it in \`generate_handler!\`, declare it in \`app/commands.ts\`; call \`commands.name(args)\` or wrap with \`commandQuery\`/\`commandMutation\` for the query cache. Use \`isTauri()\` to keep the web build working.\n- Events from Rust: \`useTauriEvent('name', handler)\`; to Rust: \`emitTauri('name', payload)\`. Permissions go in \`src-tauri/capabilities/default.json\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/tauri')
      c.removePackages(['@kitr/tauri', '@tauri-apps/api', '@tauri-apps/cli'])
      c.removeAgentsSection('tauri')
    },
  }),
  capacitor: r({
    name: 'capacitor',
    package: '@kitr/capacitor',
    client: true,
    description:
      'iOS and Android with Capacitor: config in one place, platform helpers and app-lifecycle hooks (back button, deep links, foreground).',
    configure(ctx, c) {
      const name = displayName(ctx.pkg.name)
      const id = name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'
      const start = ctx.readRc().packages.includes('@kitr/server')
      c.installPackages([
        '@kitr/capacitor',
        '@capacitor/core',
        '@capacitor/app',
        { name: '@capacitor/cli', dev: true },
      ])
      c.addPackage('@kitr/capacitor')
      c.addScript('cap', 'cap')
      c.addScript('cap:sync', `${ctx.pm} build && cap sync`)
      c.addScript('cap:ios', 'cap open ios')
      c.addScript('cap:android', 'cap open android')
      ctx.write(
        'config/capacitor.ts',
        `import { defineConfig } from 'kitr/capacitor'

/** One source for capacitor.config.ts and the app. */
export default defineConfig({
  appId: 'com.example.${id}',
  appName: '${name}',
  webDir: '${start ? 'dist/client' : 'dist'}',
  // Live reload on a device: set CAP_SERVER_URL=http://<your-ip>:5173 then \`pnpm cap sync\`.
  devServerUrl: process.env.CAP_SERVER_URL,
})
`,
      )
      ctx.write(
        'capacitor.config.ts',
        `import type { CapacitorConfig } from '@capacitor/cli'
import app from './config/capacitor'

const config: CapacitorConfig = {
  appId: app.appId,
  appName: app.appName,
  webDir: app.webDir ?? 'dist',
  ...(app.devServerUrl ? { server: { url: app.devServerUrl, cleartext: true } } : {}),
  ...app.extra,
}

export default config
`,
      )
      ctx.write(
        'app/native.ts',
        `import { isNative, perPlatform, platform } from 'kitr/capacitor'

/** Platform-aware values in one place, so components never branch on user agents. */
export const native = {
  isNative: isNative(),
  platform: platform(),
  // Example: where files open. Web gets a download, native gets the share sheet.
  openFile: perPlatform({
    web: () => (url: string) => window.open(url, '_blank'),
    native: () => (url: string) => window.open(url, '_system'),
  }),
}
`,
      )
      c.addAgentsSection(
        'capacitor',
        `- \`pnpm cap add ios|android\` once, then \`pnpm cap:sync\` after every web build and \`pnpm cap:ios\` / \`cap:android\` to open the native project. Config comes from \`config/capacitor.ts\` (capacitor.config.ts mirrors it).\n- Platform checks: \`isNative()\`, \`platform()\`, \`perPlatform({ web, native, ios, android })\` from \`kitr/capacitor\`; never sniff the user agent. Lifecycle: \`useBackButton\`, \`useAppUrlOpen\` (deep links), \`useAppState\` (foreground/background).\n- Other plugins (\`@capacitor/camera\`...) are plain dependencies; wrap their calls in \`nativeOnly(fn, fallback)\` so the web build keeps working.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removePackage('@kitr/capacitor')
      c.removePackages(['@kitr/capacitor', '@capacitor/core', '@capacitor/app', '@capacitor/cli'])
      c.removeAgentsSection('capacitor')
    },
  }),
  storage: r({
    name: 'storage',
    package: '@kitr/storage',
    description:
      'Typed localStorage/sessionStorage items and cookies with one API on the client and the server; SSR-safe hooks.',
    configure(ctx, c) {
      const serverOnly = ctx.isServerOnly()
      c.installPackages(['@kitr/storage'])
      c.addProvider('@kitr/storage/provider')
      c.addPackage('@kitr/storage')
      ctx.write(
        'config/storage.ts',
        `import { defineConfig } from 'kitr/storage'

export default defineConfig({
  // Prefixes every storage key and cookie name so several apps on one origin never collide.
  prefix: '${(ctx.pkg.name ?? 'app').replace(/^@[^/]+\//, '').replace(/[^a-z0-9]+/gi, '-')}:',
  cookie: { path: '/', sameSite: 'lax', secure: import.meta.env?.PROD ?? false },
})
`,
      )
      ctx.write(
        'app/storage.ts',
        serverOnly
          ? `import { defineCookie } from 'kitr/storage'

/** Cookies are typed once and read with \`cookies(event).get(item)\` from kitr/storage/server. */
export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
`
          : `import { defineCookie, defineStorage } from 'kitr/storage'

/**
 * Every persisted value, in one file, typed. Components read them with
 * \`useStorage(item)\` / \`useCookie(item)\` from kitr/storage/react; plain code with \`item.get()\`.
 */
export const sidebar = defineStorage('sidebar', { default: { collapsed: false } })

export const recentSearches = defineStorage<string[]>('recent-searches', {
  default: [],
  area: 'session',
  version: 1,
})

/** Readable on the server too (\`localeCookie.get(request.headers)\`), so SSR picks the right locale. */
export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
`,
      )
      c.addAgentsSection(
        'storage',
        serverOnly
          ? `- Cookies: declare with \`defineCookie\` in \`app/storage.ts\`; in controllers use \`const jar = cookies(ctx.event)\` from \`kitr/storage/server\`, then \`jar.get(item)\` / \`jar.set(item, value, { httpOnly: true })\`.`
          : `- Persisted values are declared once in \`app/storage.ts\` (\`defineStorage\` for local/session storage, \`defineCookie\` for cookies) and never read through \`localStorage\`/\`document.cookie\` directly.\n- Components: \`const [value, setValue] = useStorage(item)\` / \`useCookie(item)\` from \`kitr/storage/react\`. Both are hydration-safe: the server and first render see the default.\n- Server side (actions, controllers): \`cookies(event).get(item)\` / \`.set(item, value)\` from \`kitr/storage/server\`; wrap the root route in \`<CookieHeader value={request.headers.get('cookie')}>\` so \`useCookie\` renders the right value during SSR.\n- Add \`schema\` (zod/valibot) to validate what comes back from storage, \`version\` + \`migrate\` when a shape changes, \`ttl\` to expire.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/storage/provider')
      c.removePackage('@kitr/storage')
      c.removePackages(['@kitr/storage'])
      c.removeAgentsSection('storage')
    },
  }),
  devtools: r({
    name: 'devtools',
    package: '@kitr/devtools',
    client: true,
    description:
      'The development overlay: app, router, query cache, auth, http, storage, errors and analytics panels, a command palette, and a log every package writes to. Stripped from production builds.',
    configure(ctx, c) {
      c.installPackages(['@kitr/devtools'])
      c.addProvider('@kitr/devtools/provider')
      c.addPackage('@kitr/devtools')
      ctx.write(
        'config/devtools.ts',
        `import { defineConfig } from 'kitr/devtools'

/** Development only. The kitr() Vite plugin drops the provider from production builds. */
export default defineConfig({
  position: 'bottom-left',
  // ctrl/cmd+shift+<key> toggles the overlay; ctrl/cmd+shift+P opens the command palette.
  shortcutKey: 'k',
  maxEntries: 500,
})
`,
      )
      c.addAgentsSection(
        'devtools',
        `- In development a "k" button (ctrl/cmd+shift+K) opens the kitr devtools: App, Router, Query, Auth, Storage, Errors, Analytics and Log panels, plus a command palette (ctrl/cmd+shift+P) with every package's actions.\n- Log from anywhere with \`getDevtools(app)?.log('channel', 'label', data)\` (\`kitr/devtools\`); it is null in production so the call costs nothing.\n- A provider adds its own panel with a \`devtools(app)\` method returning \`DevtoolsPanel[]\` (lazy-import the React parts); reuse \`JsonView\`, \`KeyValue\`, \`LogList\` from \`kitr/devtools/ui\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/devtools/provider')
      c.removePackage('@kitr/devtools')
      c.removePackages(['@kitr/devtools'])
      c.removeAgentsSection('devtools')
    },
  }),
}
