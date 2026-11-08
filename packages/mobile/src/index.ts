import { definePlatform, type PlatformContext, type PlatformFinding } from '@kitr/core'

/** A native project the mobile platform creates and builds: `ios` (Xcode) or `android` (Android Studio). */
export type MobileTarget = 'ios' | 'android'

/** Options of the mobile platform, as written in `mobile({ ... })` in kitrrc.ts and edited by `kitr config <name>`. */
export interface MobileOptions {
  /** Which native projects to create and run. Default both. */
  targets: MobileTarget[]
  /** Reverse-DNS bundle id. Default `com.example.<app>`. */
  appId?: string
  /** Name shown on the home screen. Default the package name. */
  appName?: string
  /**
   * Custom URL scheme for deep links (`acme` opens `acme://...`). `kitr build` and `kitr dev`
   * register it in the iOS Info.plist and the Android manifest; `kitr doctor` checks it is there.
   */
  scheme?: string
  /** Dev server port the device loads from with `kitr dev <name>`. Default 3100. */
  port: number
  /** Extra Capacitor config merged last (`plugins`, `server`...). */
  capacitor?: Record<string, unknown>
}

const TARGETS: MobileTarget[] = ['ios', 'android']

/**
 * iOS and Android through Capacitor. The native projects live in `platforms/<name>/ios` and
 * `platforms/<name>/android`; the app bundle is the same client build the web platform ships.
 *
 *   platforms: { phone: mobile({ targets: ['ios', 'android'] }) }
 *   kitr dev phone --target ios      # live reload on a simulator or device
 *   kitr build phone                 # builds the web bundle and syncs it into both projects
 */
export const mobile = definePlatform<MobileOptions>(
  {
    type: 'mobile',
    description: 'iOS and Android app with Capacitor.',
    provider: '@kitr/mobile/provider',
    requires: ['router', 'platform', 'storage'],
    describe: {
      targets: { description: 'Native targets', type: 'list', values: TARGETS, default: TARGETS },
      appId: { description: 'Bundle identifier (reverse DNS)', type: 'string' },
      appName: { description: 'Display name', type: 'string' },
      scheme: { description: 'Custom URL scheme for deep links', type: 'string' },
      port: { description: 'Dev server port for live reload', type: 'number', default: 3100 },
    },
    options: {
      '~standard': {
        version: 1,
        vendor: 'kitr',
        validate(value) {
          const v = (value ?? {}) as Partial<MobileOptions>
          const targets = v.targets ?? TARGETS
          const bad = targets.filter((t) => !TARGETS.includes(t))
          if (bad.length)
            return {
              issues: [
                {
                  message: `targets must be ios or android, got ${bad.join(', ')}`,
                  path: ['targets'],
                },
              ],
            }
          return {
            value: {
              targets,
              appId: v.appId,
              appName: v.appName,
              scheme: v.scheme,
              port: v.port ?? 3100,
              capacitor: v.capacitor,
            },
          }
        },
      },
    },
  },
  (options) => ({
    dependencies: [
      { name: '@capacitor/core' },
      { name: '@capacitor/app' },
      { name: '@capacitor/preferences' },
      { name: '@capacitor/cli', dev: true },
      ...options.targets.map((t) => ({ name: `@capacitor/${t}` })),
    ],
    scaffold(ctx) {
      const pkg = readPackage(ctx)
      const name = options.appName ?? displayName(pkg.name)
      const id =
        options.appId ?? `com.example.${name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'}`
      ctx.write(
        `platforms/${ctx.name}/capacitor.config.ts`,
        `import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Written by kitr from \`${ctx.name}: mobile({...})\` in kitrrc.ts. Native projects live next to this file;
 * \`kitr dev ${ctx.name}\` sets \`server.url\` for live reload, \`kitr build ${ctx.name}\` syncs the built bundle.
 */
const config: CapacitorConfig = {
  appId: '${id}',
  appName: '${name.replace(/'/g, "\\'")}',
  webDir: '../../dist/${ctx.name}/client',
  ios: { path: 'ios' },
  android: { path: 'android' },
  ...(process.env.CAP_SERVER_URL ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } } : {}),
  ${options.capacitor ? `...${JSON.stringify(options.capacitor, null, 2).replace(/\n/g, '\n  ')},` : ''}
}

export default config
`,
      )
      ctx.write(
        `platforms/${ctx.name}/.gitignore`,
        'ios/App/Pods\nios/App/build\nandroid/build\nandroid/app/build\nandroid/.gradle\n',
      )
    },
    async dev(ctx) {
      const target = pickTarget(ctx, options)
      await ensureNativeProject(ctx, target, options)
      const port = Number(ctx.flags.port ?? options.port)
      const host = String(ctx.flags.host ?? (await lanAddress()))
      ctx.log.info(
        `${ctx.name}: dev server on http://${host}:${port}, the ${target} app loads it live`,
      )
      const vite = ctx.exec('vite', ['dev', '--port', String(port), '--strictPort', '--host', host])
      await waitForPort(host, port, ctx.signal)
      await ctx
        .exec(
          'cap',
          [
            'run',
            target,
            '--no-sync',
            ...(ctx.flags.device ? ['--target', String(ctx.flags.device)] : []),
          ],
          {
            cwd: ctx.dir(),
            env: { CAP_SERVER_URL: `http://${host}:${port}` },
          },
        )
        .catch((e) => ctx.log.error(String(e)))
      await vite
    },
    async build(ctx) {
      await ctx.exec('vite', ['build'])
      for (const target of targetsFor(ctx, options)) await ensureNativeProject(ctx, target, options)
      await ctx.exec('cap', ['sync'], { cwd: ctx.dir() })
      if (ctx.flags.open)
        for (const target of targetsFor(ctx, options))
          await ctx.exec('cap', ['open', target], { cwd: ctx.dir() })
      ctx.log.success(
        `${ctx.name}: synced dist/${ctx.name}/client into platforms/${ctx.name}/{${options.targets.join(',')}}. Open with \`${ctx.pm} exec cap open ios\` from platforms/${ctx.name}.`,
      )
    },
    doctor(ctx) {
      const out: PlatformFinding[] = []
      const deps = { ...readPackage(ctx).dependencies, ...readPackage(ctx).devDependencies }
      for (const dep of [
        '@capacitor/core',
        '@capacitor/cli',
        '@capacitor/app',
        '@capacitor/preferences',
        ...options.targets.map((t) => `@capacitor/${t}`),
      ])
        if (!(dep in deps))
          out.push({
            level: 'error',
            message: `${ctx.name}: ${dep} is not installed`,
            fix: `${ctx.pm} add ${dep}`,
          })
      if (!ctx.exists(`platforms/${ctx.name}/capacitor.config.ts`))
        out.push({
          level: 'error',
          message: `${ctx.name}: platforms/${ctx.name}/capacitor.config.ts is missing`,
          fix: `kitr platforms scaffold ${ctx.name}`,
        })
      for (const target of options.targets) {
        if (!ctx.exists(`platforms/${ctx.name}/${target}`)) {
          out.push({
            level: 'info',
            message: `${ctx.name}: the ${target} project is not created yet`,
            fix: `kitr build ${ctx.name} (runs cap add ${target})`,
          })
          continue
        }
        const file = `platforms/${ctx.name}/${schemeFiles[target]}`
        if (
          options.scheme &&
          ctx.exists(file) &&
          !declaresScheme(target, ctx.read(file), options.scheme)
        )
          out.push({
            level: 'warn',
            message: `${ctx.name}: ${file} does not declare the ${options.scheme}:// scheme, so deep links will not open the app`,
            fix: `kitr build ${ctx.name} (registers it)`,
          })
      }
      return out
    },
    agents: `- \`kitr dev ${'<name>'} --target ios|android\` runs the app on a simulator or device with live reload; \`kitr build <name>\` builds the bundle and runs \`cap sync\`. Native projects are in \`platforms/<name>/ios|android\` and are yours to edit in Xcode or Android Studio.
- Never branch on user agents: use \`usePlatform()\` / \`platform.is('ios')\` from \`@kitr/platform/react\`. Storage items from \`@kitr/storage\` persist in native Preferences here, so \`localStorage\` eviction on iOS never loses data.
- Other Capacitor plugins are plain dependencies; wrap their calls in \`nativeOnly(fn, fallback)\` from \`@kitr/mobile/client\` so the web build keeps working.`,
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

function targetsFor(ctx: PlatformContext, options: MobileOptions): MobileTarget[] {
  const flag = ctx.flags.target
  if (!flag) return options.targets
  const list = (Array.isArray(flag) ? flag : String(flag).split(',')) as MobileTarget[]
  for (const t of list)
    if (!options.targets.includes(t))
      throw new Error(`${ctx.name} has no ${t} target (targets: ${options.targets.join(', ')})`)
  return list
}

function pickTarget(ctx: PlatformContext, options: MobileOptions): MobileTarget {
  const list = targetsFor(ctx, options)
  if (list.length > 1 && !ctx.flags.target) {
    const def = process.platform === 'darwin' ? 'ios' : 'android'
    ctx.log.info(`${ctx.name}: running ${def} (pass --target android|ios to choose)`)
    return options.targets.includes(def as MobileTarget) ? (def as MobileTarget) : list[0]!
  }
  return list[0]!
}

async function ensureNativeProject(
  ctx: PlatformContext,
  target: MobileTarget,
  options: MobileOptions,
) {
  if (!ctx.exists(`platforms/${ctx.name}/${target}`)) {
    ctx.log.step(`${ctx.name}: creating the ${target} project (cap add ${target})`)
    await ctx.exec('cap', ['add', target], { cwd: ctx.dir() })
  }
  if (options.scheme) registerScheme(ctx, target, options.scheme)
}

/** Where each native project declares its URL schemes. */
export const schemeFiles: Record<MobileTarget, string> = {
  ios: 'ios/App/App/Info.plist',
  android: 'android/app/src/main/AndroidManifest.xml',
}

/** Whether a native project's Info.plist or manifest already declares `scheme`. */
export function declaresScheme(target: MobileTarget, source: string, scheme: string): boolean {
  if (target === 'android')
    return new RegExp(`android:scheme="${escapeRegExp(scheme)}"`).test(source)
  const at = source.indexOf('CFBundleURLSchemes')
  return at >= 0 && new RegExp(`<string>${escapeRegExp(scheme)}</string>`).test(source.slice(at))
}

/**
 * Add `scheme` to a native project's Info.plist (CFBundleURLTypes) or Android manifest (an
 * intent filter on the launcher activity). Returns the source unchanged when it is already there
 * or the file has no place for it.
 */
export function addScheme(target: MobileTarget, source: string, scheme: string): string {
  if (declaresScheme(target, source, scheme)) return source
  if (target === 'ios') {
    const entry = `<dict>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${scheme}</string>\n\t\t\t</array>\n\t\t</dict>`
    if (source.includes('<key>CFBundleURLTypes</key>'))
      return source.replace(/(<key>CFBundleURLTypes<\/key>\s*<array>)/, `$1\n\t\t${entry}`)
    const last = source.lastIndexOf('</dict>')
    if (last < 0) return source
    return `${source.slice(0, last)}\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t${entry}\n\t</array>\n${source.slice(last)}`
  }
  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${scheme}" />
            </intent-filter>`
  const launcher = source.search(/<action android:name="android\.intent\.action\.MAIN"\s*\/>/)
  if (launcher < 0) return source
  const end = source.indexOf('</activity>', launcher)
  if (end < 0) return source
  return `${source.slice(0, end).replace(/\s*$/, '')}${filter}\n        ${source.slice(end)}`
}

function registerScheme(ctx: PlatformContext, target: MobileTarget, scheme: string) {
  const file = `platforms/${ctx.name}/${schemeFiles[target]}`
  if (!ctx.exists(file)) return
  const source = ctx.read(file)
  const next = addScheme(target, source, scheme)
  if (next === source) return
  ctx.write(file, next, { overwrite: true })
  ctx.log.step(`${ctx.name}: registered the ${scheme}:// scheme in ${file}`)
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function lanAddress(): Promise<string> {
  try {
    const os = await import('node:os')
    for (const list of Object.values(os.networkInterfaces()))
      for (const net of list ?? []) if (net.family === 'IPv4' && !net.internal) return net.address
  } catch {}
  return '0.0.0.0'
}

async function waitForPort(host: string, port: number, signal?: AbortSignal) {
  const target = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/`
  for (let i = 0; i < 100; i++) {
    if (signal?.aborted) return
    try {
      await fetch(target, { method: 'HEAD' })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
}
