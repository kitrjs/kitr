import { definePlatform, type PlatformContext } from '@kitr/core'
import { displayName, readPackage, shellPlatformHooks, slug } from '@kitr/platform/cli'

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
  (options) =>
    shellPlatformHooks(options, {
      dependencies: [
        { name: '@tauri-apps/api' },
        { name: '@tauri-apps/plugin-store' },
        // The provider opens links and quits through these two.
        { name: '@tauri-apps/plugin-opener' },
        { name: '@tauri-apps/plugin-process' },
        // The device packages' drivers (secure-storage, notifications, files, updater, native)
        // load these on first use; `kitr/tauri/provider` registers them for the bundler.
        { name: '@tauri-apps/plugin-stronghold' },
        { name: '@tauri-apps/plugin-notification' },
        { name: '@tauri-apps/plugin-dialog' },
        { name: '@tauri-apps/plugin-fs' },
        { name: '@tauri-apps/plugin-updater' },
        { name: '@tauri-apps/plugin-os' },
        { name: '@tauri-apps/plugin-clipboard-manager' },
        { name: '@tauri-apps/cli', dev: true },
      ],
      scaffold(ctx) {
        scaffoldTauri(ctx, options)
      },
      dev: {
        banner: (ctx, { url }) =>
          `${ctx.name}: dev server on ${url}, the Tauri window loads it live`,
        ready: (ctx) => ensureIcons(ctx),
        launch: (ctx, { url }) => {
          // tauri.conf.json holds the port from scaffold time; --port and KITR_<NAME>_PORT win over it.
          const config = JSON.stringify({ build: { devUrl: url } })
          return ctx.exec('tauri', ['dev', '--no-watch', '--config', config], {
            cwd: ctx.dir(),
            env: { KITR_DEV_URL: url, KITR_DEVTOOLS: options.devtools ? '1' : '0' },
          })
        },
      },
      build: {
        before: (ctx) => ensureIcons(ctx),
        async shell(ctx) {
          await ctx.exec('tauri', ['build', ...(ctx.flags.debug ? ['--debug'] : [])], {
            cwd: ctx.dir(),
          })
          ctx.log.success(
            `${ctx.name}: installers are in platforms/${ctx.name}/src-tauri/target/release/bundle`,
          )
        },
      },
      async start(ctx) {
        ctx.log.info(
          `${ctx.name}: run the installed app or the binary in platforms/${ctx.name}/src-tauri/target/release`,
        )
      },
      doctor: {
        // The device plugins are only needed once their package is used, so doctor leaves them out.
        dependencies: [
          { name: '@tauri-apps/api' },
          { name: '@tauri-apps/plugin-store' },
          { name: '@tauri-apps/plugin-opener' },
          { name: '@tauri-apps/plugin-process' },
          { name: '@tauri-apps/cli', dev: true },
        ],
        files: (ctx) => [{ path: `platforms/${ctx.name}/src-tauri/tauri.conf.json` }],
        // The shell is a Rust binary: no cargo, no build.
        tools: [
          {
            command: 'cargo',
            message: 'the Rust toolchain (cargo) is not on PATH, and Tauri builds with it',
            fix: 'Install Rust from https://rustup.rs, then open a new terminal',
          },
        ],
      },
      agents: `- \`kitr dev <name>\` starts Vite and the Tauri window; \`kitr build <name>\` builds the client and installers. Rust lives in \`platforms/<name>/src-tauri\` (needs the Rust toolchain).
- Commands: add \`#[tauri::command]\` in src-tauri/src/lib.rs, register it in \`generate_handler!\`, declare it in \`app/commands.ts\` (\`defineCommands\` from \`kitr/tauri/client\`); call \`commands.name(args)\` or wrap with \`commandQuery\`/\`commandMutation\`. Guard with \`isTauri()\` so the web build keeps working.
- Events from Rust: \`useTauriEvent('name', handler)\`; to Rust: \`emitTauri('name', payload)\`. Permissions go in \`src-tauri/capabilities/default.json\`. Storage items from \`kitr/storage\` persist through the store plugin here.`,
    }),
)

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
          // Tauri hashes the inline scripts in the built client and adds them to this policy.
          security: { csp: CSP },
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
tauri-plugin-process = "2"
tauri-plugin-notification = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-os = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-stronghold = "2"
keyring = { version = "3", features = ["apple-native", "windows-native", "sync-secret-service"] }
rand = "0.8"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-updater = "2"
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

/// The password of the secure-storage vault (a Stronghold snapshot): a random secret that lives in
/// the operating system's keyring, created on first use. \`@kitr/secure-storage\` calls it as
/// \`invoke('kitr_vault_key')\`.
#[tauri::command]
fn kitr_vault_key(app: tauri::AppHandle) -> Result<String, String> {
    let entry = keyring::Entry::new(&app.config().identifier, "kitr-vault").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(secret) => Ok(secret),
        Err(keyring::Error::NoEntry) => {
            let bytes: [u8; 32] = rand::random();
            let secret: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            entry.set_password(&secret).map_err(|e| e.to_string())?;
            Ok(secret)
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            use tauri::Manager;
            // Secure storage: an encrypted Stronghold snapshot, its key derived with Argon2 from the keyring secret.
            let salt = app.path().app_local_data_dir()?.join("salt.txt");
            app.handle().plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt).build())?;
            // The updater needs \`plugins.updater\` (a public key and endpoints) in tauri.conf.json: it is
            // only registered when you have added it, so a new app starts without one.
            #[cfg(desktop)]
            if app.config().plugins.0.contains_key("updater") {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            // \`kitr dev\` sets KITR_DEVTOOLS from the platform's \`devtools\` option.
            #[cfg(debug_assertions)]
            if std::env::var("KITR_DEVTOOLS").as_deref() == Ok("1") {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, kitr_vault_key])
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
        permissions: [
          'core:default',
          'store:default',
          'opener:default',
          'process:default',
          // @kitr/notifications
          'notification:default',
          // @kitr/files: the dialogs, and read/write/stat on the paths the person picks (the dialog
          // plugin adds each chosen path to the scope for the session).
          'dialog:default',
          'fs:allow-read-file',
          'fs:allow-write-file',
          'fs:allow-stat',
          'fs:allow-read-dir',
          { identifier: 'opener:allow-open-path', allow: [{ path: '$HOME/**' }] },
          // @kitr/native
          'os:default',
          'clipboard-manager:allow-read-text',
          'clipboard-manager:allow-write-text',
          // @kitr/secure-storage
          'stronghold:default',
          // @kitr/updater (the plugin is registered once tauri.conf.json has plugins.updater)
          'updater:default',
        ],
      },
      null,
      2,
    )}\n`,
  )
  ctx.write(`${base}/.gitignore`, '/target\n/gen/schemas\n')
  ctx.write(
    `${base}/icons/README.md`,
    `\`kitr dev ${ctx.name}\` and \`kitr build ${ctx.name}\` generate a placeholder set here when it is missing. For your own, run \`${ctx.pm} exec tauri icon path/to/icon.png\` (1024x1024) from platforms/${ctx.name}.\n`,
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

/** The default policy: the app's own files, Tauri's IPC, and https/wss APIs. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' asset: http://asset.localhost data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ipc: http://ipc.localhost https: wss:",
].join('; ')

const ICONS = ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.icns', 'icon.ico']

/** Tauri will not compile without the icons tauri.conf.json lists: make a placeholder set once. */
export async function ensureIcons(ctx: PlatformContext) {
  const dir = `platforms/${ctx.name}/src-tauri/icons`
  if (ICONS.every((icon) => ctx.exists(`${dir}/${icon}`))) return
  const { writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const source = join(ctx.dir(), 'app-icon.png')
  if (!ctx.exists(`platforms/${ctx.name}/app-icon.png`))
    writeFileSync(source, await placeholderPng())
  ctx.log.info(`${ctx.name}: generating icons from platforms/${ctx.name}/app-icon.png`)
  await ctx.exec('tauri', ['icon', 'app-icon.png'], { cwd: ctx.dir() })
}

/** A 1024x1024 rounded square in one colour: enough for Tauri, and obviously a placeholder. */
export async function placeholderPng(size = 1024): Promise<Buffer> {
  const { deflateSync } = await import('node:zlib')
  const radius = size * 0.2
  const row = size * 4 + 1
  const raw = Buffer.alloc(row * size)
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0
    for (let x = 0; x < size; x++) {
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0)
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0)
      const inside = dx * dx + dy * dy <= radius * radius
      const at = y * row + 1 + x * 4
      raw[at] = 0x63
      raw[at + 1] = 0x66
      raw[at + 2] = 0xf1
      raw[at + 3] = inside ? 255 : 0
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
