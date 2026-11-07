import { definePlatform, type PlatformContext, type PlatformFinding } from '@kitr/core'

export type DesktopShell = 'tauri' | 'electron'

export interface DesktopOptions {
  /** `tauri` (Rust shell, small binaries) or `electron` (Chromium + Node). Default `tauri`. */
  shell: DesktopShell
  /** Dev server port the shell loads from with `kitr dev <name>`. Default 3200. */
  port: number
  /** Window title. Default the package name. */
  title?: string
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  /** Reverse-DNS bundle id. Default `com.example.<app>`. */
  appId?: string
  /** Open devtools in dev. Default true. */
  devtools: boolean
}

const SHELLS: DesktopShell[] = ['tauri', 'electron']

/**
 * macOS, Windows and Linux through a Tauri or Electron shell. The native project lives in
 * `platforms/<name>/`; the window loads the same client build the web platform ships.
 *
 *   platforms: { app: desktop({ shell: 'tauri' }) }
 *   kitr dev app        # Vite on :3200 and the native window with HMR
 *   kitr build app      # client build into dist/<name>/client, then installers
 */
export const desktop = definePlatform<DesktopOptions>(
  {
    type: 'desktop',
    description: 'Desktop app with a Tauri or Electron shell.',
    provider: '@kitr/desktop/provider',
    requires: ['router', 'platform', 'storage'],
    describe: {
      shell: { description: 'Native shell', type: 'string', values: SHELLS, default: 'tauri' },
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
          const shell = v.shell ?? 'tauri'
          if (!SHELLS.includes(shell))
            return {
              issues: [
                { message: `shell must be tauri or electron, got ${shell}`, path: ['shell'] },
              ],
            }
          return {
            value: {
              shell,
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
  (options) => ({
    dependencies:
      options.shell === 'tauri'
        ? [
            { name: '@tauri-apps/api' },
            { name: '@tauri-apps/plugin-store' },
            { name: '@tauri-apps/cli', dev: true },
          ]
        : [
            { name: 'electron', dev: true },
            { name: 'electron-vite', dev: true },
            { name: 'electron-builder', dev: true },
          ],
    scaffold(ctx) {
      if (options.shell === 'tauri') scaffoldTauri(ctx, options)
      else scaffoldElectron(ctx, options)
    },
    async dev(ctx) {
      const port = Number(ctx.flags.port ?? options.port)
      const url = `http://localhost:${port}`
      ctx.log.info(`${ctx.name}: dev server on ${url}, the ${options.shell} window loads it live`)
      const vite = ctx.exec('vite', ['dev', '--port', String(port), '--strictPort'])
      await waitForUrl(url, ctx.signal)
      if (options.shell === 'tauri') {
        await ctx
          .exec('tauri', ['dev', '--no-watch'], { cwd: ctx.dir(), env: { KITR_DEV_URL: url } })
          .catch((e) => ctx.log.error(String(e)))
      } else {
        await ctx
          .exec(
            'electron-vite',
            ['dev', '-c', ctx.dir('electron.vite.config.ts'), '--rendererOnly=false'],
            {
              env: { ELECTRON_RENDERER_URL: url },
            },
          )
          .catch((e) => ctx.log.error(String(e)))
      }
      await vite
    },
    async build(ctx) {
      await ctx.exec('vite', ['build'])
      if (options.shell === 'tauri') {
        await ctx.exec('tauri', ['build', ...(ctx.flags.debug ? ['--debug'] : [])], {
          cwd: ctx.dir(),
        })
        ctx.log.success(
          `${ctx.name}: installers are in platforms/${ctx.name}/src-tauri/target/release/bundle`,
        )
      } else {
        await ctx.exec('electron-vite', ['build', '-c', ctx.dir('electron.vite.config.ts')])
        if (ctx.flags.pack === false) return
        await ctx.exec('electron-builder', [
          '--config',
          ctx.dir('electron-builder.yml'),
          ...(ctx.flags.dir ? ['--dir'] : []),
        ])
        ctx.log.success(`${ctx.name}: installers are in dist/${ctx.name}/release`)
      }
    },
    async start(ctx) {
      if (options.shell === 'tauri') {
        ctx.log.info(
          `${ctx.name}: run the installed app or the binary in platforms/${ctx.name}/src-tauri/target/release`,
        )
        return
      }
      await ctx.exec('electron', [ctx.root])
    },
    doctor(ctx) {
      const out: PlatformFinding[] = []
      const pkg = readPackage(ctx)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const needed =
        options.shell === 'tauri'
          ? ['@tauri-apps/api', '@tauri-apps/cli', '@tauri-apps/plugin-store']
          : ['electron', 'electron-vite', 'electron-builder']
      for (const dep of needed)
        if (!(dep in deps))
          out.push({
            level: 'error',
            message: `${ctx.name}: ${dep} is not installed`,
            fix: `${ctx.pm} add -D ${dep}`,
          })
      if (options.shell === 'tauri') {
        if (!ctx.exists(`platforms/${ctx.name}/src-tauri/tauri.conf.json`))
          out.push({
            level: 'error',
            message: `${ctx.name}: platforms/${ctx.name}/src-tauri is missing`,
            fix: `kitr platforms scaffold ${ctx.name}`,
          })
      } else {
        if (!ctx.exists(`platforms/${ctx.name}/main.ts`))
          out.push({
            level: 'error',
            message: `${ctx.name}: platforms/${ctx.name}/main.ts is missing`,
            fix: `kitr platforms scaffold ${ctx.name}`,
          })
        if (pkg.main !== `dist/${ctx.name}/electron/main/index.js`)
          out.push({
            level: 'warn',
            message: `${ctx.name}: package.json "main" should be dist/${ctx.name}/electron/main/index.js so electron and electron-builder find the built main process`,
          })
      }
      return out
    },
    agents:
      options.shell === 'tauri'
        ? `- \`kitr dev <name>\` starts Vite and the Tauri window; \`kitr build <name>\` builds the client and installers. Rust lives in \`platforms/<name>/src-tauri\` (needs the Rust toolchain).
- Commands: add \`#[tauri::command]\` in src-tauri/src/lib.rs, register it in \`generate_handler!\`, declare it in \`app/commands.ts\` (\`defineCommands\` from \`kitr/desktop/tauri\`); call \`commands.name(args)\` or wrap with \`commandQuery\`/\`commandMutation\`. Guard with \`isTauri()\` so the web build keeps working.
- Events from Rust: \`useTauriEvent('name', handler)\`; to Rust: \`emitTauri('name', payload)\`. Permissions go in \`src-tauri/capabilities/default.json\`. Storage items from \`kitr/storage\` persist through the store plugin here.`
        : `- \`kitr dev <name>\` starts Vite and Electron (main + preload rebuilt on change); \`kitr build <name>\` builds the client, main and preload into \`dist/<name>\` and packages installers with electron-builder.
- IPC is typed end to end: declare in \`platforms/<name>/ipc.ts\`, implement in \`platforms/<name>/main.ts\` (\`handleIpc\`), call from the app via \`createIpcClient\` from \`kitr/desktop/electron\`. Guard desktop-only UI with \`isElectron()\`.
- Windows keep context isolation and the sandbox on; never enable nodeIntegration. The packaged app serves the client from \`app://-/\`; storage items from \`kitr/storage\` persist in a JSON file in userData through \`handleKitrIpc\`.`,
  }),
)

function readPackage(ctx: PlatformContext): Record<string, any> {
  try {
    return JSON.parse(ctx.read('package.json'))
  } catch {
    return {}
  }
}

function displayName(name = 'app') {
  return name
    .replace(/^@[^/]+\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function slug(name: string) {
  return name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'
}

function scaffoldTauri(ctx: PlatformContext, options: DesktopOptions) {
  const pkg = readPackage(ctx)
  const name = options.title ?? displayName(pkg.name)
  const crate =
    name
      .replace(/[^a-z0-9]+/gi, '_')
      .toLowerCase()
      .replace(/^_+|_+$/g, '') || 'app'
  const base = `platforms/${ctx.name}/src-tauri`
  ctx.write(
    `${base}/tauri.conf.json`,
    `${JSON.stringify(
      {
        $schema: 'https://schema.tauri.app/config/2',
        productName: name,
        version: pkg.version ?? '0.1.0',
        identifier: options.appId ?? `com.example.${slug(name)}`,
        build: {
          frontendDist: `../../../dist/${ctx.name}/client`,
          devUrl: `http://localhost:${options.port}`,
        },
        app: {
          windows: [
            {
              title: name,
              width: options.width,
              height: options.height,
              ...(options.minWidth ? { minWidth: options.minWidth } : {}),
              ...(options.minHeight ? { minHeight: options.minHeight } : {}),
            },
          ],
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
    `${base}/Cargo.toml`,
    `[package]
name = "${crate}"
version = "${pkg.version ?? '0.1.0'}"
edition = "2021"

[lib]
name = "${crate}_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-store = "2"
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
`,
  )
  ctx.write(`${base}/build.rs`, 'fn main() {\n    tauri_build::build()\n}\n')
  ctx.write(
    `${base}/src/main.rs`,
    `// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ${crate}_lib::run()
}
`,
  )
  ctx.write(
    `${base}/src/lib.rs`,
    `/// Called from the app as \`commands.greet({ name })\` (app/commands.ts).
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`,
  )
  ctx.write(
    `${base}/capabilities/default.json`,
    `${JSON.stringify(
      {
        $schema: '../gen/schemas/desktop-schema.json',
        identifier: 'default',
        description: 'Capabilities for the main window',
        windows: ['main'],
        permissions: ['core:default', 'store:default', 'opener:default'],
      },
      null,
      2,
    )}\n`,
  )
  ctx.write(`${base}/.gitignore`, '/target\n/gen/schemas\n')
  ctx.write(
    `${base}/icons/README.md`,
    `Run \`${ctx.pm} exec tauri icon path/to/icon.png\` (1024x1024) from platforms/${ctx.name} to generate every size listed in tauri.conf.json.\n`,
  )
  ctx.write(
    'app/commands.ts',
    `import { defineCommands } from 'kitr/desktop/tauri'

/** Mirrors the \`#[tauri::command]\` functions in platforms/${ctx.name}/src-tauri/src/lib.rs. */
export type Commands = {
  greet: (args: { name: string }) => string
}

/** \`await commands.greet({ name })\`: typed. Guard with \`isTauri()\` for web builds. */
export const commands = defineCommands<Commands>()
`,
  )
}

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
 * The IPC contract shared by main, preload and the renderer. Add a command here, implement it
 * in main.ts, call it from the app with \`ipc.invoke('...')\`.
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
    `${base}/main.ts`,
    `import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { createIpcEmitter, createMainWindow, handleIpc, handleKitrIpc, registerAppScheme } from 'kitr/desktop/electron-main'
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
import { exposeIpc } from 'kitr/desktop/electron-preload'

// Only the channels declared in ipc.ts (and kitr's own kitr:* channels) reach the renderer.
exposeIpc(contextBridge, ipcRenderer)
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
    build: { lib: { entry: 'main.ts' }, outDir: '../../dist/${ctx.name}/electron/main' },
  },
  preload: {
    root: __dirname,
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'preload.ts' }, outDir: '../../dist/${ctx.name}/electron/preload' },
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
    `import { createIpcClient } from 'kitr/desktop/electron'
import type { Ipc, IpcPush } from '../platforms/${ctx.name}/ipc'

/** Typed renderer-side client. \`ipc.available\` is false in a plain browser, so the web build still runs. */
export const ipc = createIpcClient<Ipc, IpcPush>()
`,
  )
  const main = `dist/${ctx.name}/electron/main/index.js`
  if (pkg.main !== main) {
    pkg.main = main
    ctx.write('package.json', `${JSON.stringify(pkg, null, 2)}\n`, { overwrite: true })
  }
}

async function waitForUrl(url: string, signal?: AbortSignal) {
  for (let i = 0; i < 100; i++) {
    if (signal?.aborted) return
    try {
      await fetch(url, { method: 'HEAD' })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
}
