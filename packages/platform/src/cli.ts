import type {
  PlatformContext,
  PlatformDependency,
  PlatformFinding,
  PlatformHooks,
} from '@kitr/core'

/**
 * The shared skeleton of the desktop, tauri and mobile platform packages: scaffold, dev, build,
 * start and doctor, parameterised by what differs (paths, commands, required tools). Each package
 * keeps its own options, its templates and the vendor commands it runs; the sequence around them
 * (dev server, wait for it, launch the shell; client build, shell build; dependency, file and tool
 * checks) lives here once. The `definePlatform` contract is unchanged: `shellPlatformHooks()`
 * returns the hooks the factory returns.
 *
 * Node only. Import it from a platform's setup code, never from the browser.
 */

/** The options every shell platform has. */
export interface ShellPlatformOptions {
  /** Dev server port the shell loads from with `kitr dev <name>`. */
  port: number
}

/** Read `package.json`, or `{}` when it is missing or invalid. */
export function readPackage(ctx: PlatformContext): Record<string, any> {
  try {
    return JSON.parse(ctx.read('package.json'))
  } catch {
    return {}
  }
}

/** `@acme/field-notes` becomes `Field Notes`: the default window or home-screen title. */
export function displayName(name = 'app'): string {
  return name
    .replace(/^@[^/]+\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** The lower-case alphanumeric form of a name, for bundle ids: `Field Notes` becomes `fieldnotes`. */
export function slug(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'
}

/** Poll `url` until it answers (any response, even an error status) or `signal` aborts. Gives up after about 30 seconds. */
export async function waitForUrl(url: string, signal?: AbortSignal): Promise<void> {
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

/** `waitForUrl` for a host and port; a wildcard bind address (`0.0.0.0`) is polled on loopback. */
export function waitForPort(host: string, port: number, signal?: AbortSignal): Promise<void> {
  return waitForUrl(`http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/`, signal)
}

/** The machine's first non-internal IPv4 address, for a device on the network to reach the dev server; `0.0.0.0` when there is none. */
export async function lanAddress(): Promise<string> {
  try {
    const os = await import('node:os')
    for (const list of Object.values(os.networkInterfaces()))
      for (const net of list ?? []) if (net.family === 'IPv4' && !net.internal) return net.address
  } catch {}
  return '0.0.0.0'
}

/** Whether `command --version` runs and exits 0: the check behind "the Rust toolchain is not on PATH". */
export async function hasCommand(command: string): Promise<boolean> {
  const { spawnSync } = await import('node:child_process')
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  return !result.error && result.status === 0
}

/** Where a dependency is declared and how to install it, for the `kitr doctor` fix line. */
export function installCommand(ctx: PlatformContext, dependency: PlatformDependency): string {
  return `${ctx.pm} add ${dependency.dev ? '-D ' : ''}${dependency.name}`
}

/** One `error` finding per dependency the project's `package.json` does not list. */
export function missingDependencies(
  ctx: PlatformContext,
  dependencies: PlatformDependency[],
  pkg: Record<string, any> = readPackage(ctx),
): PlatformFinding[] {
  const declared = { ...pkg.dependencies, ...pkg.devDependencies }
  return dependencies
    .filter((dep) => !(dep.name in declared))
    .map((dep) => ({
      level: 'error' as const,
      message: `${ctx.name}: ${dep.name} is not installed`,
      fix: installCommand(ctx, dep),
    }))
}

/** A file the shell needs: reported as `error` when missing, with the command that recreates it. */
export interface RequiredFile {
  /** Path from the project root. */
  path: string
  /** The `kitr doctor` fix line. Default: `kitr platforms scaffold <name>`. */
  fix?: string
}

/** A command-line tool the shell builds with: `cargo` for Tauri. */
export interface RequiredTool {
  /** The executable, checked with `<command> --version`. */
  command: string
  /** The finding's message; `<name>:` is prepended. */
  message: string
  /** The fix line. */
  fix?: string
}

/** What `kitr doctor` checks for a shell platform. */
export interface ShellDoctor<O extends object> {
  /** Dependencies that must be in `package.json`. Default: the platform's `dependencies`. */
  dependencies?: PlatformDependency[]
  /** Files that must exist, relative to the project root. */
  files?(ctx: PlatformContext<O>): RequiredFile[]
  /** Tools that must be on `PATH`. */
  tools?: RequiredTool[]
  /** Checks of your own (a `main` field, a registered URL scheme). Appended last. */
  extra?(ctx: PlatformContext<O>, pkg: Record<string, any>): PlatformFinding[]
}

/** What `kitr dev <name>` runs: the Vite dev server and then the shell on top of it. */
export interface ShellDev<O extends object, S = undefined> {
  /** Runs before the dev server starts (create the native project, pick a target); its result goes to the other hooks. */
  prepare?(ctx: PlatformContext<O>): S | Promise<S>
  /** The address Vite binds to. Default: Vite's own (localhost). The mobile shell passes the LAN address. */
  host?(ctx: PlatformContext<O>): string | undefined | Promise<string | undefined>
  /** The line logged once the server's address is known. */
  banner(ctx: PlatformContext<O>, dev: ShellDevInfo<S>): string
  /** Runs while Vite starts, before waiting for it (generate icons). */
  ready?(ctx: PlatformContext<O>, dev: ShellDevInfo<S>): void | Promise<void>
  /** Start the shell against the dev server. Errors are logged, and the dev server keeps running until it exits. */
  launch(ctx: PlatformContext<O>, dev: ShellDevInfo<S>): Promise<void>
}

/** What the `dev` hooks know about the running dev server. */
export interface ShellDevInfo<S = undefined> {
  /** The port, from `--port` or the platform option. */
  port: number
  /** The bind address, when `host()` gave one. */
  host: string | undefined
  /** `http://<host or localhost>:<port>`. */
  url: string
  /** What `prepare()` returned. */
  state: S
}

/** What `kitr build <name>` runs after the client build. */
export interface ShellBuild<O extends object> {
  /** Build the shell around `dist/<name>/client` (installers, a synced native project). */
  shell(ctx: PlatformContext<O>): Promise<void>
  /** Runs before the client build (generate icons, create native projects). */
  before?(ctx: PlatformContext<O>): void | Promise<void>
}

/** How a shell package parameterises the platform CLI skeleton. */
export interface ShellCli<O extends ShellPlatformOptions, S = undefined> {
  /** npm dependencies `kitr add` installs; `kitr doctor` checks them too. */
  dependencies: PlatformDependency[]
  /** Write the shell's files. */
  scaffold(ctx: PlatformContext<O>): void
  /** `kitr dev <name>`. */
  dev: ShellDev<O, S>
  /** `kitr build <name>`. */
  build: ShellBuild<O>
  /** `kitr start <name>`. Omit when the shell has nothing to start (the mobile app runs on a device). */
  start?(ctx: PlatformContext<O>): Promise<void>
  /** `kitr doctor`. */
  doctor?: ShellDoctor<O>
  /** Lines for the platform's `AGENTS.md` section. */
  agents: string
}

/**
 * The hooks of a shell platform, for the factory `definePlatform` takes:
 *
 *   definePlatform<MyOptions>(definition, (options) => shellPlatformHooks(options, { ... }))
 *
 * `dev` starts Vite on `--port` (or the option), waits for it, then launches the shell; `build`
 * runs the client build and then the shell's own; `doctor` checks dependencies, files and tools.
 */
export function shellPlatformHooks<O extends ShellPlatformOptions, S = undefined>(
  options: O,
  cli: ShellCli<O, S>,
): PlatformHooks<O> {
  return {
    dependencies: cli.dependencies,
    scaffold: cli.scaffold,
    async dev(ctx) {
      const state = (await cli.dev.prepare?.(ctx)) as S
      const port = Number(ctx.flags.port ?? options.port)
      const host = await cli.dev.host?.(ctx)
      const url = `http://${host ?? 'localhost'}:${port}`
      const dev: ShellDevInfo<S> = { port, host, url, state }
      ctx.log.info(cli.dev.banner(ctx, dev))
      const vite = ctx.exec('vite', [
        'dev',
        '--port',
        String(port),
        '--strictPort',
        ...(host ? ['--host', host] : []),
      ])
      await cli.dev.ready?.(ctx, dev)
      await waitForUrl(host === '0.0.0.0' ? `http://127.0.0.1:${port}` : url, ctx.signal)
      await cli.dev.launch(ctx, dev).catch((e) => ctx.log.error(String(e)))
      await vite
    },
    async build(ctx) {
      await cli.build.before?.(ctx)
      await ctx.exec('vite', ['build'])
      await cli.build.shell(ctx)
    },
    start: cli.start,
    doctor(ctx) {
      const pkg = readPackage(ctx)
      const out: PlatformFinding[] = missingDependencies(
        ctx,
        cli.doctor?.dependencies ?? cli.dependencies,
        pkg,
      )
      for (const file of cli.doctor?.files?.(ctx) ?? [])
        if (!ctx.exists(file.path))
          out.push({
            level: 'error',
            message: `${ctx.name}: ${file.path} is missing`,
            fix: file.fix ?? `kitr platforms scaffold ${ctx.name}`,
          })
      const finish = () => [...out, ...(cli.doctor?.extra?.(ctx, pkg) ?? [])]
      const tools = cli.doctor?.tools ?? []
      // Synchronous unless a tool has to be probed, so callers that need no process get an array back.
      if (!tools.length) return finish()
      return (async () => {
        for (const tool of tools)
          if (!(await hasCommand(tool.command)))
            out.push({ level: 'error', message: `${ctx.name}: ${tool.message}`, fix: tool.fix })
        return finish()
      })()
    },
    agents: cli.agents,
  }
}
