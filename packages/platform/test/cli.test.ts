import { definePlatform, type PlatformContext } from '@kitr/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aborted, fakePlatformContext } from '../../../tests/setup/platform-context'
import {
  displayName,
  hasCommand,
  installCommand,
  lanAddress,
  missingDependencies,
  readPackage,
  type ShellPlatformOptions,
  shellPlatformHooks,
  slug,
  waitForPort,
  waitForUrl,
} from '../src/cli'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

interface KioskOptions extends ShellPlatformOptions {
  tool: string
}

/** A shell platform parameterised the way desktop, tauri and mobile are, over a made-up shell. */
const kiosk = definePlatform<KioskOptions>({ type: 'kiosk' }, (options) =>
  shellPlatformHooks<KioskOptions, { target: string }>(options, {
    dependencies: [{ name: 'kiosk-shell', dev: true }, { name: 'kiosk-api' }],
    scaffold: (ctx) => void ctx.write(`platforms/${ctx.name}/kiosk.json`, '{}'),
    dev: {
      prepare: (ctx) => ({ target: String(ctx.flags.target ?? 'main') }),
      host: (ctx) => (ctx.flags.host ? String(ctx.flags.host) : undefined),
      banner: (ctx, { url, state }) => `${ctx.name}: ${state.target} on ${url}`,
      ready: (ctx) => void ctx.log.step('icons'),
      launch: (ctx, { url, state }) => ctx.exec(options.tool, ['run', state.target, url]),
    },
    build: {
      before: (ctx) => void ctx.log.step('before'),
      shell: (ctx) => ctx.exec(options.tool, ['pack']),
    },
    start: (ctx) => ctx.exec(options.tool, ['start']),
    doctor: {
      files: (ctx) => [
        { path: `platforms/${ctx.name}/kiosk.json` },
        { path: 'kiosk.lock', fix: 'kiosk init' },
      ],
      tools: [{ command: 'definitely-not-a-real-binary-kitr', message: 'kiosk is not on PATH' }],
      extra: (ctx) => [{ level: 'info', message: `${ctx.name}: extra` }],
    },
    agents: 'kiosk agents',
  }),
)

const defaults = { port: 3300, tool: 'kiosk' }
const make = (flags: PlatformContext['flags'] = {}, files: Record<string, string> = {}) => {
  const app = kiosk(defaults)
  return { app, f: fakePlatformContext(app, { flags, files, signal: aborted() }) }
}

describe('shellPlatformHooks', () => {
  it('returns the definePlatform hooks, keeping the contract intact', () => {
    const app = kiosk(defaults)
    expect(app.type).toBe('kiosk')
    expect(app.dependencies).toEqual([{ name: 'kiosk-shell', dev: true }, { name: 'kiosk-api' }])
    expect(app.agents).toBe('kiosk agents')
    for (const hook of ['scaffold', 'dev', 'build', 'start', 'doctor'] as const)
      expect(app[hook], hook).toBeTypeOf('function')
  })

  it('scaffold and start run the shell package hooks', async () => {
    const { app, f } = make()
    app.scaffold!(f.ctx)
    expect(f.files.has('platforms/app/kiosk.json')).toBe(true)
    await app.start!(f.ctx)
    expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([['kiosk', 'start']])
  })

  it('omits start when the shell has none', () => {
    const noStart = definePlatform<ShellPlatformOptions>({ type: 'x' }, (options) =>
      shellPlatformHooks(options, {
        dependencies: [],
        scaffold() {},
        dev: { banner: () => '', launch: async () => {} },
        build: { shell: async () => {} },
        agents: '',
      }),
    )
    expect(noStart({ port: 1 }).start).toBeUndefined()
  })

  describe('dev', () => {
    it('starts Vite on the option port, then launches the shell against its URL', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response()),
      )
      const app = kiosk(defaults)
      const f = fakePlatformContext(app, { flags: { target: 'side' } })
      await app.dev!(f.ctx)
      expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([
        ['vite', 'dev', '--port', '3300', '--strictPort'],
        ['kiosk', 'run', 'side', 'http://localhost:3300'],
      ])
      expect(f.logs).toEqual(['info: app: side on http://localhost:3300', 'step: icons'])
    })

    it('lets --port override the option, and binds the host the shell asks for', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response()),
      )
      const app = kiosk(defaults)
      const f = fakePlatformContext(app, { flags: { port: '4100', host: '192.168.1.20' } })
      await app.dev!(f.ctx)
      expect(f.calls[0]!.args).toEqual([
        'dev',
        '--port',
        '4100',
        '--strictPort',
        '--host',
        '192.168.1.20',
      ])
      expect(f.calls[1]!.args).toEqual(['run', 'main', 'http://192.168.1.20:4100'])
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://192.168.1.20:4100')
    })

    it('polls a wildcard bind address on loopback', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response()),
      )
      const app = kiosk(defaults)
      const f = fakePlatformContext(app, { flags: { host: '0.0.0.0' } })
      await app.dev!(f.ctx)
      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://127.0.0.1:3300')
    })

    it('logs a failing shell and still waits for the dev server', async () => {
      const { app } = make()
      const f = fakePlatformContext(app, { flags: {}, signal: aborted() })
      const exec = f.ctx.exec
      f.ctx.exec = async (command, args, options) => {
        if (command === 'kiosk') throw new Error('shell crashed')
        return exec(command, args, options)
      }
      await app.dev!(f.ctx)
      expect(f.logs).toContain('error: Error: shell crashed')
    })
  })

  describe('build', () => {
    it('runs before(), the client build, then the shell build', async () => {
      const { app, f } = make()
      await app.build!(f.ctx)
      expect(f.logs).toEqual(['step: before'])
      expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([
        ['vite', 'build'],
        ['kiosk', 'pack'],
      ])
    })
  })

  describe('doctor', () => {
    it('reports missing dependencies, files and tools, then the shell extras', async () => {
      const { app, f } = make(
        {},
        { 'package.json': JSON.stringify({ devDependencies: { 'kiosk-shell': '1' } }) },
      )
      const findings = await app.doctor!(f.ctx)
      expect(findings.map((x) => [x.level, x.message, x.fix])).toEqual([
        ['error', 'app: kiosk-api is not installed', 'pnpm add kiosk-api'],
        ['error', 'app: platforms/app/kiosk.json is missing', 'kitr platforms scaffold app'],
        ['error', 'app: kiosk.lock is missing', 'kiosk init'],
        ['error', 'app: kiosk is not on PATH', undefined],
        ['info', 'app: extra', undefined],
      ])
    })

    it('is clean when everything is there', async () => {
      const app = definePlatform<ShellPlatformOptions>({ type: 'x' }, (options) =>
        shellPlatformHooks(options, {
          dependencies: [{ name: 'a' }],
          scaffold() {},
          dev: { banner: () => '', launch: async () => {} },
          build: { shell: async () => {} },
          doctor: { files: () => [{ path: 'x.json' }] },
          agents: '',
        }),
      )({ port: 1 })
      const f = fakePlatformContext(app, {
        files: { 'package.json': '{"dependencies":{"a":"1"}}', 'x.json': '{}' },
      })
      // No tools to probe: the answer is a plain array, not a promise.
      expect(app.doctor!(f.ctx)).toEqual([])
    })
  })
})

describe('helpers', () => {
  const ctxWith = (files: Record<string, string>, pm: PlatformContext['pm'] = 'pnpm') =>
    fakePlatformContext(kiosk(defaults), { files, pm }).ctx

  it('readPackage reads package.json, or {} when it is missing or broken', () => {
    expect(readPackage(ctxWith({ 'package.json': '{"name":"notes"}' }))).toEqual({ name: 'notes' })
    expect(readPackage(ctxWith({}))).toEqual({})
    expect(readPackage(ctxWith({ 'package.json': '{nope' }))).toEqual({})
  })

  it('displayName and slug derive window titles and bundle ids', () => {
    expect(displayName('@acme/field-notes')).toBe('Field Notes')
    expect(displayName('ledger_app')).toBe('Ledger App')
    expect(displayName()).toBe('App')
    expect(slug('Field Notes!')).toBe('fieldnotes')
    expect(slug('!!!')).toBe('app')
  })

  it('missingDependencies and installCommand follow the package manager and dev flag', () => {
    const ctx = ctxWith({ 'package.json': '{"dependencies":{"a":"1"}}' }, 'npm')
    expect(installCommand(ctx, { name: 'x', dev: true })).toBe('npm add -D x')
    expect(
      missingDependencies(ctx, [{ name: 'a' }, { name: 'b' }, { name: 'c', dev: true }]).map(
        (x) => x.fix,
      ),
    ).toEqual(['npm add b', 'npm add -D c'])
  })

  it('waitForUrl returns on any response and on abort, and retries a refused connection', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue(new Response())
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()
    const done = waitForUrl('http://localhost:3300')
    await vi.advanceTimersByTimeAsync(400)
    await done
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()

    fetchMock.mockClear()
    await waitForUrl('http://localhost:3300', aborted())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('waitForPort polls loopback for a wildcard host', async () => {
    const fetchMock = vi.fn(async () => new Response())
    vi.stubGlobal('fetch', fetchMock)
    await waitForPort('0.0.0.0', 3100)
    await waitForPort('10.0.0.5', 3100)
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'http://127.0.0.1:3100/',
      'http://10.0.0.5:3100/',
    ])
  })

  it('lanAddress answers an IPv4 address', async () => {
    expect(await lanAddress()).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
  })

  it('hasCommand tells an installed tool from a missing one', async () => {
    expect(await hasCommand(process.execPath)).toBe(true)
    expect(await hasCommand('definitely-not-a-real-binary-kitr')).toBe(false)
  })
})
