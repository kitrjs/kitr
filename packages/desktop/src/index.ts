import { definePlatform, type PlatformContext } from '@kitr/core'
import { displayName, readPackage, shellPlatformHooks, slug } from '@kitr/platform/cli'

/**
 * Options of `desktop()` in `kitrrc.ts`. Every option but `port` is written into the scaffolded
 * `main.ts` and `electron-builder.yml` by `kitr add`; edit those files to change them later.
 */
export interface DesktopOptions {
  /** Dev server port the window loads from with `kitr dev <name>`. Default 3200. */
  port: number
  /** Window title. Default the package name. */
  title?: string
  /** Initial window width in pixels. Default 1200. */
  width: number
  /** Initial window height in pixels. Default 800. */
  height: number
  /** Smallest width the user can resize the window to. */
  minWidth?: number
  /** Smallest height the user can resize the window to. */
  minHeight?: number
  /** Reverse-DNS bundle id. Default `com.example.<app>`. */
  appId?: string
  /** Open devtools in dev. Default true. */
  devtools: boolean
}

/**
 * macOS, Windows and Linux through an Electron shell: Chromium and Node ship inside the app, so
 * it renders the same everywhere. The main and preload processes live in `platforms/<name>/`;
 * the window loads the same client build the web platform ships. For a smaller binary on the
 * OS webview, use `kitr/tauri` instead.
 *
 *   platforms: { app: desktop({ title: 'Acme' }) }
 *   kitr dev app        # Vite on :3200 and the Electron window with HMR
 *   kitr build app      # client build into dist/<name>/client, then installers
 */
export const desktop = definePlatform<DesktopOptions>(
  {
    type: 'desktop',
    description: 'Desktop app with an Electron shell.',
    provider: '@kitr/desktop/provider',
    requires: ['router', 'platform', 'storage'],
    describe: {
      port: { description: 'Dev server port the window loads from', type: 'number', default: 3200 },
      title: { description: 'Window title', type: 'string' },
      width: { description: 'Initial window width', type: 'number', default: 1200 },
      height: { description: 'Initial window height', type: 'number', default: 800 },
      minWidth: { description: 'Minimum window width', type: 'number' },
      minHeight: { description: 'Minimum window height', type: 'number' },
      appId: { description: 'Bundle identifier (reverse DNS)', type: 'string' },
      devtools: { description: 'Open devtools in dev', type: 'boolean', default: true },
    },
    options: {
      '~standard': {
        version: 1,
        vendor: 'kitr',
        validate(value) {
          const v = (value ?? {}) as Partial<DesktopOptions>
          return {
            value: {
              port: v.port ?? 3200,
              title: v.title,
              width: v.width ?? 1200,
              height: v.height ?? 800,
              minWidth: v.minWidth,
              minHeight: v.minHeight,
              appId: v.appId,
              devtools: v.devtools ?? true,
            },
          }
        },
      },
    },
  },
  (options) =>
    shellPlatformHooks(options, {
      dependencies: [
        { name: 'electron', dev: true },
        { name: 'electron-vite', dev: true },
        { name: 'electron-builder', dev: true },
        // The updater package's driver imports it in the main process; a runtime dependency so
        // electron-builder packs it into the installer.
        { name: 'electron-updater' },
      ],
      scaffold(ctx) {
        scaffoldElectron(ctx, options)
      },
      dev: {
        banner: (ctx, { url }) =>
          `${ctx.name}: dev server on ${url}, the Electron window loads it live`,
        launch: (ctx, { url }) =>
          ctx.exec(
            'electron-vite',
            ['dev', '-c', ctx.dir('electron.vite.config.ts'), '--rendererOnly=false'],
            { env: { ELECTRON_RENDERER_URL: url } },
          ),
      },
      build: {
        async shell(ctx) {
          await ctx.exec('electron-vite', ['build', '-c', ctx.dir('electron.vite.config.ts')])
          if (ctx.flags.pack === false) return
          await ctx.exec('electron-builder', [
            '--config',
            ctx.dir('electron-builder.yml'),
            ...(ctx.flags.dir ? ['--dir'] : []),
          ])
          ctx.log.success(`${ctx.name}: installers are in dist/${ctx.name}/release`)
        },
      },
      async start(ctx) {
        await ctx.exec('electron', [ctx.root])
      },
      doctor: {
        // electron-updater is only needed once the updater package is used, so doctor leaves it out.
        dependencies: [
          { name: 'electron', dev: true },
          { name: 'electron-vite', dev: true },
          { name: 'electron-builder', dev: true },
        ],
        files: (ctx) => [{ path: `platforms/${ctx.name}/main.ts` }],
        extra: (ctx, pkg) =>
          pkg.main === `dist/${ctx.name}/electron/main/index.js`
            ? []
            : [
                {
                  level: 'warn',
                  message: `${ctx.name}: package.json "main" should be dist/${ctx.name}/electron/main/index.js so electron and electron-builder find the built main process`,
                },
              ],
      },
      agents: `- \`kitr dev <name>\` starts Vite and Electron (main + preload rebuilt on change); \`kitr build <name>\` builds the client, main and preload into \`dist/<name>\` and packages installers with electron-builder.
- IPC is typed end to end: declare in \`platforms/<name>/ipc.ts\`, implement in \`platforms/<name>/main.ts\` (\`handleIpc\`), call from the app via \`createIpcClient\` from \`kitr/desktop/client\`. Guard desktop-only UI with \`isElectron()\`.
- Windows keep context isolation and the sandbox on; never enable nodeIntegration. The packaged app serves the client from \`app://-/\`; storage items from \`kitr/storage\` persist in a JSON file in userData through \`handleKitrIpc\`.`,
    }),
)

function scaffoldElectron(ctx: PlatformContext, options: DesktopOptions) {
  const pkg = readPackage(ctx)
  const name = options.title ?? displayName(pkg.name)
  const base = `platforms/${ctx.name}`
  const win = JSON.stringify({
    title: name,
    width: options.width,
    height: options.height,
    ...(options.minWidth ? { minWidth: options.minWidth } : {}),
    ...(options.minHeight ? { minHeight: options.minHeight } : {}),
  })
  ctx.write(
    `${base}/ipc.ts`,
    `/**
 * The IPC contract shared by main, preload and the renderer. Add a command here and to
 * \`channels\`, implement it in main.ts, call it from the app with \`ipc.invoke('...')\`.
 */
export type Ipc = {
  'app.version': () => string
  'dialog.openFile': (filters?: Array<{ name: string; extensions: string[] }>) => string | null
}

/** Events pushed from main to the renderer. */
export type IpcPush = {
  'app.focus': (focused: boolean) => void
}

/** Every channel above, at run time: preload lets only these (and kitr:*) through. */
export const channels = {
  'app.version': true,
  'dialog.openFile': true,
  'app.focus': true,
} satisfies Record<keyof Ipc | keyof IpcPush, true>
`,
  )
  ctx.write(
    `${base}/main.ts`,
    `import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { createIpcEmitter, createMainWindow, handleIpc, handleKitrIpc, registerAppScheme } from 'kitr/desktop/main'
import type { Ipc, IpcPush } from './ipc'

const window = ${win}

registerAppScheme(protocol)

const push = createIpcEmitter<IpcPush>(() => BrowserWindow.getAllWindows()[0]?.webContents)

handleIpc<Ipc>(ipcMain, {
  'app.version': () => app.getVersion(),
  'dialog.openFile': async (_event, filters) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  },
})

app.whenReady().then(async () => {
  handleKitrIpc(ipcMain, app)
  const win = await createMainWindow({ ...window, devtools: ${options.devtools} })
  win.on('focus', () => push.emit('app.focus', true))
  win.on('blur', () => push.emit('app.focus', false))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow(window)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
`,
  )
  ctx.write(
    `${base}/preload.ts`,
    `import { contextBridge, ipcRenderer } from 'electron'
import { allowChannels, exposeIpc } from 'kitr/desktop/preload'
import { channels } from './ipc'

// Only the channels declared in ipc.ts (and kitr's own kitr:* channels) reach the renderer.
exposeIpc(contextBridge, ipcRenderer, { allow: allowChannels(channels) })
`,
  )
  ctx.write(
    `${base}/electron.vite.config.ts`,
    `import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

/** Main and preload only. The renderer is the kitr client build in dist/${ctx.name}/client. */
export default defineConfig({
  main: {
    root: __dirname,
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: 'main.ts' },
      outDir: '../../dist/${ctx.name}/electron/main',
      rollupOptions: { output: { entryFileNames: 'index.js' } },
    },
  },
  preload: {
    root: __dirname,
    // A sandboxed preload can only require electron, so kitr is bundled into it.
    plugins: [externalizeDepsPlugin({ exclude: ['kitr', '@kitr/desktop'] })],
    // A sandboxed preload script cannot be an ES module, so it is built as CommonJS.
    build: {
      lib: { entry: 'preload.ts' },
      outDir: '../../dist/${ctx.name}/electron/preload',
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.js' } },
    },
  },
})
`,
  )
  ctx.write(
    `${base}/electron-builder.yml`,
    `appId: ${options.appId ?? `com.example.${slug(name)}`}
productName: ${name}
directories:
  output: dist/${ctx.name}/release
files:
  - dist/${ctx.name}/client/**
  - dist/${ctx.name}/electron/**
  - package.json
mac:
  category: public.app-category.productivity
win:
  target: nsis
linux:
  target: AppImage
`,
  )
  ctx.write(
    'app/ipc.ts',
    `import { createIpcClient } from 'kitr/desktop/client'
import type { Ipc, IpcPush } from '../platforms/${ctx.name}/ipc'

/** Typed renderer-side client. \`ipc.available\` is false in a plain browser, so the web build still runs. */
export const ipc = createIpcClient<Ipc, IpcPush>()
`,
  )
  const main = `dist/${ctx.name}/electron/main/index.js`
  if (pkg.main !== main || !pkg.version) {
    pkg.main = main
    pkg.version ??= '0.0.0' // electron-builder refuses a package.json without one
    ctx.write('package.json', `${JSON.stringify(pkg, null, 2)}\n`, { overwrite: true })
  }
}
