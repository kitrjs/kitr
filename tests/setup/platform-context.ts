import type { PlatformContext, PlatformInstance } from '@kitr/core'

export interface Call {
  kind: 'exec' | 'run'
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
}

/**
 * An in-memory PlatformContext for testing platform packages: files live in a map, and
 * exec/run record what would have been spawned instead of spawning it.
 */
export function fakePlatformContext(
  instance: PlatformInstance,
  init: {
    name?: string
    files?: Record<string, string>
    flags?: PlatformContext['flags']
    env?: Record<string, string | undefined>
    platforms?: PlatformInstance[]
    signal?: AbortSignal
    pm?: PlatformContext['pm']
  } = {},
) {
  const name = init.name ?? 'app'
  const files = new Map(Object.entries(init.files ?? {}))
  const calls: Call[] = []
  const logs: string[] = []
  const log = (level: string) => (msg: string) => logs.push(`${level}: ${msg}`)
  const ctx: PlatformContext = {
    name,
    root: '/project',
    options: instance.options,
    pm: init.pm ?? 'pnpm',
    flags: init.flags ?? {},
    platforms: init.platforms ?? [instance],
    env: init.env ?? {},
    signal: init.signal,
    log: {
      info: log('info'),
      success: log('success'),
      warn: log('warn'),
      error: log('error'),
      step: log('step'),
    },
    dir: (...parts) => ['/project/platforms', name, ...parts].join('/'),
    exists: (path) =>
      files.has(path) || [...files.keys()].some((f) => f.startsWith(`${path.replace(/\/$/, '')}/`)),
    read: (path) => {
      const content = files.get(path)
      if (content === undefined) throw new Error(`ENOENT: ${path}`)
      return content
    },
    write(path, content, options = {}) {
      if (files.has(path) && !options.overwrite) return false
      files.set(path, content)
      return true
    },
    async run(command, args = [], options = {}) {
      calls.push({ kind: 'run', command, args, cwd: options.cwd, env: options.env })
    },
    async exec(command, args = [], options = {}) {
      calls.push({ kind: 'exec', command, args, cwd: options.cwd, env: options.env })
    },
  }
  return { ctx, files, calls, logs }
}

/** An already-aborted signal: hooks that wait for a dev server return at once. */
export const aborted = () => {
  const c = new AbortController()
  c.abort()
  return c.signal
}
