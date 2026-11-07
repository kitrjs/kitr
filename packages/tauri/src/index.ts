import { definePlatform, type PlatformContext, type PlatformFinding } from '@kitr/core'

/**
 * Options of `tauri()` in `kitrrc.ts`. They are written into the scaffolded `tauri.conf.json` by
 * `kitr add`, which the Tauri CLI reads; edit that file to change them later.
 */
export interface TauriOptions {
  /** Dev server port the window loads from with `kitr dev <name>`, also written as `build.devUrl`. Default 3200. */
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
  /** Accepted for parity with `desktop()`; the Tauri scaffold does not use it. Default true. */
  devtools: boolean
}

/**
 * macOS, Windows and Linux through a Tauri shell: a small Rust binary around the webview the
 * operating system provides. The Rust project lives in `platforms/<name>/src-tauri`; the window
 * loads the same client build the web platform ships. For a bundled Chromium that renders the
 * same everywhere, use `kitr/desktop` (Electron) instead.
 *
 *   platforms: { app: tauri({ title: 'Acme' }) }
 *   kitr dev app        # Vite on :3200 and the Tauri window with HMR
 *   kitr build app      # client build into dist/<name>/client, then installers
 */
export const tauri = definePlatform<TauriOptions>(
  {
    type: 'tauri',
    description: 'Desktop app with a Tauri shell.',
    provider: '@kitr/tauri/provider',
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
          const v = (value ?? {}) as Partial<TauriOptions>
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
  (options) => ({
    dependencies: [
      { name: '@tauri-apps/api' },
      { name: '@tauri-apps/plugin-store' },
      { name: '@tauri-apps/cli', dev: true },
    ],
    scaffold(ctx) {
      scaffoldTauri(ctx, options)
    },
    async dev(ctx) {
      const port = Number(ctx.flags.port ?? options.port)
      const url = `http://localhost:${port}`
      ctx.log.info(`${ctx.name}: dev server on ${url}, the Tauri window loads it live`)
      const vite = ctx.exec('vite', ['dev', '--port', String(port), '--strictPort'])
      await waitForUrl(url, ctx.signal)
      await ctx
        .exec('tauri', ['dev', '--no-watch'], { cwd: ctx.dir(), env: { KITR_DEV_URL: url } })
        .catch((e) => ctx.log.error(String(e)))
      await vite
    },
    async build(ctx) {
      await ctx.exec('vite', ['build'])
      await ctx.exec('tauri', ['build', ...(ctx.flags.debug ? ['--debug'] : [])], {
        cwd: ctx.dir(),
      })
      ctx.log.success(
        `${ctx.name}: installers are in platforms/${ctx.name}/src-tauri/target/release/bundle`,
      )
    },
    async start(ctx) {
      ctx.log.info(
        `${ctx.name}: run the installed app or the binary in platforms/${ctx.name}/src-tauri/target/release`,
      )
    },
    doctor(ctx) {
      const out: PlatformFinding[] = []
      const pkg = readPackage(ctx)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      for (const dep of ['@tauri-apps/api', '@tauri-apps/cli', '@tauri-apps/plugin-store'])
        if (!(dep in deps))
          out.push({
            level: 'error',
            message: `${ctx.name}: ${dep} is not installed`,
            fix: `${ctx.pm} add ${dep === '@tauri-apps/cli' ? '-D ' : ''}${dep}`,
          })
      if (!ctx.exists(`platforms/${ctx.name}/src-tauri/tauri.conf.json`))
        out.push({
          level: 'error',
          message: `${ctx.name}: platforms/${ctx.name}/src-tauri is missing`,
          fix: `kitr platforms scaffold ${ctx.name}`,
        })
      return out
    },
    agents: `- \`kitr dev <name>\` starts Vite and the Tauri window; \`kitr build <name>\` builds the client and installers. Rust lives in \`platforms/<name>/src-tauri\` (needs the Rust toolchain).
- Commands: add \`#[tauri::command]\` in src-tauri/src/lib.rs, register it in \`generate_handler!\`, declare it in \`app/commands.ts\` (\`defineCommands\` from \`kitr/tauri/client\`); call \`commands.name(args)\` or wrap with \`commandQuery\`/\`commandMutation\`. Guard with \`isTauri()\` so the web build keeps working.
- Events from Rust: \`useTauriEvent('name', handler)\`; to Rust: \`emitTauri('name', payload)\`. Permissions go in \`src-tauri/capabilities/default.json\`. Storage items from \`kitr/storage\` persist through the store plugin here.`,
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

function scaffoldTauri(ctx: PlatformContext, options: TauriOptions) {
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
    `import { defineCommands } from 'kitr/tauri/client'

/** Mirrors the \`#[tauri::command]\` functions in platforms/${ctx.name}/src-tauri/src/lib.rs. */
export type Commands = {
  greet: (args: { name: string }) => string
}

/** \`await commands.greet({ name })\`: typed. Guard with \`isTauri()\` for web builds. */
export const commands = defineCommands<Commands>()
`,
  )
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
