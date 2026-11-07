// The platforms kitr ships to, for the home page and /platforms/<type>.
// Prose and snippets live here; scripts/platforms.mjs adds what the repo knows (which packages
// run there, whether the platform package is published, which guides cover it) at build time.
//
// `type` is the platform type in kitrrc.ts and the package name (`@kitr/<type>`).
// `exclude` drops packages that run on the client or the server in general but make no sense
// here (server actions and SEO need a web platform that renders HTML).
// `native` are packages whose drivers switch to the platform's own APIs.
// `guides` are fallbacks used until the guides section lists its own `platforms`.

export const platforms = [
  {
    type: 'web',
    label: 'SSR · SPA · PWA',
    name: 'Web',
    shell: 'Vite + TanStack Start',
    color: '#38BDF8',
    side: 'client',
    tagline:
      'Static sites, single-page apps and server-rendered apps, all from the same app folder. Installable as a PWA with one option.',
    targets: ['Static', 'SPA', 'SSR', 'PWA'],
    command: 'kitr add web site --mode ssr',
    builtOn: ['Vite', 'TanStack Start', 'vite-plugin-pwa'],
    highlights: [
      {
        title: 'Three rendering modes, one option',
        text: '`static` prerenders every route to HTML, `spa` serves one shell with client routing, and `ssr` renders on request through TanStack Start. Switch with `kitr config site mode ssr`.',
      },
      {
        title: 'Installable when you want it',
        text: '`pwa: true` adds the web manifest and a service worker. `useInstallPrompt` and `useServiceWorker` from `kitr/web/client` show the install button and the update banner.',
      },
      {
        title: 'Search engines read it',
        text: '`kitr add seo` writes `config/seo.ts`: page heads, share previews, the prerender list, the sitemap and `robots.txt` come from that one file.',
      },
      {
        title: 'As many sites as you need',
        text: 'A marketing site, an app and an admin panel are three named web platforms in one project, each with its own mode and port.',
      },
    ],
    code: `// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from 'kitr/web'

export default defineKitrConfig({
  platforms: {
    www: web({ mode: 'static' }),
    site: web({ mode: 'ssr', pwa: { name: 'Acme', themeColor: '#2D6CF0' } }),
    admin: web({ mode: 'spa', port: 3002 }),
  },
})`,
    run: [
      ['kitr dev site', 'Vite with hot reload on port 3000'],
      ['kitr build site', 'dist/site/client, plus dist/site/server/server.js in ssr mode'],
      ['kitr start site', 'serves the build with srvx'],
    ],
    exclude: [],
    native: ['seo'],
    nativeLabel: 'Built for the web',
    kits: ['app', 'fullstack', 'site', 'saas', 'realtime'],
    guides: ['dashboard', 'fullstack', 'data'],
    resources: [
      {
        title: 'TanStack Start',
        url: 'https://tanstack.com/start',
        text: 'The renderer behind ssr and static mode.',
      },
      {
        title: 'Vite',
        url: 'https://vite.dev/guide/',
        text: 'Dev server and build for every UI platform.',
      },
      {
        title: 'Vite PWA',
        url: 'https://vite-pwa-org.netlify.app/guide/',
        text: 'What pwa: true sets up underneath.',
      },
      {
        title: 'web.dev: Learn PWA',
        url: 'https://web.dev/learn/pwa',
        text: 'Install prompts, offline and updates, explained.',
      },
    ],
  },
  {
    type: 'server',
    label: 'Node · Bun · Deno',
    name: 'Server',
    shell: 'h3',
    color: '#34D399',
    side: 'server',
    tagline:
      'An HTTP API with routes, controllers and live channels, on Node, Bun, Deno or Cloudflare Workers. With React or without it.',
    targets: ['Node', 'Bun', 'Deno', 'Workers'],
    command: 'kitr add server api --runtime node',
    builtOn: ['h3'],
    highlights: [
      {
        title: 'Four runtimes, one option',
        text: "`runtime: 'bun'`, `'deno'` or `'workers'` changes how `kitr dev` and `kitr build` run the same `server/main.ts`. Workers deploy through `wrangler.toml`.",
      },
      {
        title: 'A typed client, no codegen',
        text: 'Routes and controllers live in `server/routes.ts`. The client your pages call is typed from that table, so a renamed field is a type error, not a bug report.',
      },
      {
        title: 'Inside your site or beside it',
        text: 'A project with a web platform also gets `app/routes/api.$.ts`, which mounts the same server inside TanStack Start. Run it there, or as its own process.',
      },
      {
        title: 'No React required',
        text: '`kitr new my-api --kit server` has no React anywhere in its dependency graph: an h3 server, routes, a database hook, logs and tests.',
      },
    ],
    code: `// server/routes.ts
import { defineRoutes } from 'kitr/api'
import HealthController from '#server/controllers/health_controller'
import OrdersController from '#server/controllers/orders_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api' }, (api) =>
    api
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .resource('orders', OrdersController),
  ),
)

/** The client your pages call is typed from this. */
export type AppRoutes = typeof routes.$types`,
    run: [
      ['kitr dev api', 'tsx watch, bun --watch or wrangler dev, by runtime'],
      ['kitr build api', 'a bundled server in dist/api'],
      ['kitr start api', 'runs the compiled server'],
    ],
    exclude: ['actions', 'seo', 'platform', 'secure-storage', 'vite'],
    native: ['api', 'db', 'cache', 'jobs', 'mail', 'shield', 'uploads'],
    nativeLabel: 'Built for the server',
    kits: ['server', 'fullstack', 'saas'],
    guides: ['pure-backend', 'fullstack'],
    resources: [
      { title: 'h3', url: 'https://h3.dev', text: 'The HTTP framework the server is built on.' },
      { title: 'Bun', url: 'https://bun.sh/docs', text: "runtime: 'bun'" },
      { title: 'Deno', url: 'https://docs.deno.com', text: "runtime: 'deno'" },
      {
        title: 'Cloudflare Workers',
        url: 'https://developers.cloudflare.com/workers/',
        text: "runtime: 'workers', deployed with wrangler.",
      },
    ],
  },
  {
    type: 'desktop',
    label: 'Electron',
    name: 'Desktop',
    shell: 'Electron',
    color: '#FB923C',
    side: 'client',
    tagline:
      'Windows, macOS and Linux in an Electron shell. Chromium ships with the app, so it looks and behaves the same on every machine.',
    targets: ['Windows', 'macOS', 'Linux'],
    command: 'kitr add desktop app',
    builtOn: ['electron-vite', 'electron-builder'],
    highlights: [
      {
        title: 'Your app, in a window',
        text: 'The same `app/` folder runs in the shell. The main and preload processes live in `platforms/app/`, and electron-builder packages the installers.',
      },
      {
        title: 'Typed IPC',
        text: 'One schema in `platforms/app/ipc.ts`: `handleIpc()` implements it in main and `createIpcClient()` calls it from your components, typed both ways.',
      },
      {
        title: 'Storage that lives on disk',
        text: 'Storage items write to `kitr-storage.json` in the app data folder instead of `localStorage`. Your code does not change.',
      },
      {
        title: 'The recommended desktop shell',
        text: 'What you test is what every user runs. Pick Tauri instead when download size matters more than identical rendering.',
      },
    ],
    code: `// platforms/app/ipc.ts
export type Ipc = {
  'app.version': () => string
  'dialog.openFile': () => string | null
}

// app/ipc.ts
import { createIpcClient } from 'kitr/desktop/client'
export const ipc = createIpcClient<Ipc>()

const version = await ipc.invoke('app.version')`,
    run: [
      ['kitr dev app', 'the Electron window, loading Vite on port 3200'],
      ['kitr build app', 'electron-vite builds main, preload and the app'],
      ['kitr start app', 'opens the built app'],
    ],
    exclude: ['actions', 'seo'],
    native: ['storage', 'platform'],
    nativeLabel: 'Switch to native here',
    kits: ['desktop'],
    guides: [],
    alternative: 'tauri',
    resources: [
      {
        title: 'Electron docs',
        url: 'https://www.electronjs.org/docs/latest/',
        text: 'Main process APIs, menus, windows.',
      },
      {
        title: 'electron-vite',
        url: 'https://electron-vite.org/guide/',
        text: 'How the three processes are built.',
      },
      {
        title: 'electron-builder',
        url: 'https://www.electron.build',
        text: 'Installers, code signing, auto update.',
      },
      {
        title: 'Electron security checklist',
        url: 'https://www.electronjs.org/docs/latest/tutorial/security',
        text: 'What the scaffold already turns on, and why.',
      },
    ],
  },
  {
    type: 'tauri',
    label: 'Rust + webview',
    name: 'Tauri',
    shell: 'Rust + system webview',
    color: '#FACC15',
    side: 'client',
    tagline:
      'Windows, macOS and Linux as a small Rust binary on the webview the operating system provides. Downloads measured in megabytes, not hundreds of them.',
    targets: ['Windows', 'macOS', 'Linux'],
    command: 'kitr add tauri app',
    builtOn: ['Tauri 2'],
    highlights: [
      {
        title: 'Small and light',
        text: 'No browser ships with the app, so installers are small and memory use is low. The webview differs between Windows, macOS and Linux, so test on each.',
      },
      {
        title: 'Typed Rust commands',
        text: '`defineCommands()` types your Rust commands for the app, and `commandQuery` turns one into a cached query like any other.',
      },
      {
        title: 'Events both ways',
        text: '`useTauriEvent()` listens to events Rust emits, and `emitTauri()` sends one back. Both do nothing in a plain browser, so the web build is unchanged.',
      },
      {
        title: 'Checked before you build',
        text: 'Builds need the Rust toolchain. `kitr doctor` checks for it, and the Rust project lives in `platforms/app/src-tauri` for you to edit.',
      },
    ],
    code: `// app/commands.ts
import { commandQuery, defineCommands } from 'kitr/tauri/client'

type Commands = { greet: (args: { name: string }) => string }
export const commands = defineCommands<Commands>()
export const greeting = commandQuery(commands.greet, 'greet')

await commands.greet({ name: 'kitr' })`,
    run: [
      ['kitr dev app', 'the Tauri window over the Vite dev server'],
      ['kitr build app', 'tauri build: a native bundle per OS'],
      ['kitr doctor', 'checks the Rust toolchain'],
    ],
    exclude: ['actions', 'seo'],
    native: ['storage', 'platform'],
    nativeLabel: 'Switch to native here',
    kits: ['tauri'],
    guides: [],
    alternative: 'desktop',
    resources: [
      {
        title: 'Tauri 2 docs',
        url: 'https://v2.tauri.app/start/',
        text: 'Commands, events, capabilities.',
      },
      {
        title: 'Prerequisites',
        url: 'https://v2.tauri.app/start/prerequisites/',
        text: 'The Rust toolchain and system webview per OS.',
      },
      {
        title: 'Store plugin',
        url: 'https://v2.tauri.app/plugin/store/',
        text: 'Where storage items are kept.',
      },
      {
        title: 'Distribute',
        url: 'https://v2.tauri.app/distribute/',
        text: 'Signing and installers for each OS.',
      },
    ],
  },
  {
    type: 'mobile',
    label: 'iOS · Android',
    name: 'Mobile',
    shell: 'Capacitor',
    color: '#A78BFA',
    side: 'client',
    tagline:
      'iPhone and Android apps through Capacitor, with storage, the back button, deep links and safe areas handled natively.',
    targets: ['iOS', 'Android'],
    command: 'kitr add mobile phone',
    builtOn: ['Capacitor'],
    highlights: [
      {
        title: 'Native projects you own',
        text: 'The Xcode and Android Studio projects live in `platforms/phone/`. `kitr dev` adds them the first time and `--target ios` picks one.',
      },
      {
        title: 'Live reload on the device',
        text: 'The app on your phone loads the dev server over the network, so a saved file shows up on the device in a second.',
      },
      {
        title: 'Hooks for the device',
        text: '`usePlatform`, `useAppState`, `useBackButton`, `useDeepLink` and `useSafeArea` answer the same way in the browser and in the app.',
      },
      {
        title: 'Storage that survives',
        text: 'Storage items move to Capacitor Preferences, which iOS and Android keep when they clear a webview to free space.',
      },
    ],
    code: `// app/components/shell.tsx
import { useBackButton, useSafeArea } from 'kitr/platform/react'
import { useCallback, type ReactNode } from 'react'

export function Shell({ children }: { children: ReactNode }) {
  const insets = useSafeArea()
  useBackButton(
    useCallback(({ canGoBack }) => canGoBack && window.history.back(), []),
  )
  return <main style={{ paddingTop: insets.top }}>{children}</main>
}`,
    run: [
      ['kitr dev phone', 'live reload on a device or simulator, port 3100'],
      ['kitr build phone', 'the web build synced into ios/ and android/'],
      ['kitr doctor', 'checks Xcode and Android Studio'],
    ],
    exclude: ['actions', 'seo'],
    native: ['storage', 'platform'],
    nativeLabel: 'Switch to native here',
    kits: ['mobile'],
    guides: [],
    resources: [
      {
        title: 'Capacitor docs',
        url: 'https://capacitorjs.com/docs',
        text: 'The native runtime under the shell.',
      },
      {
        title: 'Environment setup',
        url: 'https://capacitorjs.com/docs/getting-started/environment-setup',
        text: 'Xcode, Android Studio and simulators.',
      },
      {
        title: 'Capacitor plugins',
        url: 'https://capacitorjs.com/docs/apis',
        text: 'Camera, haptics, push and more, for your own drivers.',
      },
      {
        title: 'App Store and Play publishing',
        url: 'https://capacitorjs.com/docs/ios/deploying-to-app-store',
        text: 'Shipping the build to the stores.',
      },
    ],
  },
]

/** The mix-and-match builder on the home page and /platforms: one line per named platform. */
export const builder = {
  // Each choice: the kitrrc.ts name, the type, the platforms line and the command that adds it.
  choices: [
    {
      id: 'site',
      type: 'web',
      line: "site: web({ mode: 'ssr' }),",
      cmd: 'kitr add web site --mode ssr',
      dev: 'http://localhost:3000',
      on: true,
    },
    {
      id: 'admin',
      type: 'web',
      line: "admin: web({ mode: 'spa', port: 3002 }),",
      cmd: 'kitr add web admin --mode spa --port 3002',
      dev: 'http://localhost:3002',
    },
    {
      id: 'api',
      type: 'server',
      line: "api: server({ runtime: 'node' }),",
      cmd: 'kitr add server api',
      dev: 'http://localhost:3001',
      on: true,
    },
    {
      id: 'desktop',
      type: 'desktop',
      line: "app: desktop({ title: 'Acme' }),",
      cmd: 'kitr add desktop app',
      dev: 'Electron window',
      on: true,
      group: 'shell',
    },
    {
      id: 'tauri',
      type: 'tauri',
      line: "app: tauri({ title: 'Acme' }),",
      cmd: 'kitr add tauri app',
      dev: 'Tauri window',
      group: 'shell',
    },
    {
      id: 'phone',
      type: 'mobile',
      line: "phone: mobile({ appId: 'com.acme.app' }),",
      cmd: 'kitr add mobile phone',
      dev: 'live reload on your phone',
      on: true,
    },
  ],
}
