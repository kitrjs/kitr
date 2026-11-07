import { describe, expect, it, vi } from 'vitest'
import { createApp, KitrApp } from '../src/app'
import { getDevtools } from '../src/devtools'
import { defineProvider, resolveProvider } from '../src/provider'

describe('KitrApp lifecycle', () => {
  it('detects the test environment under vitest and honours explicit options', () => {
    expect(createApp().environment).toBe('test')
    const app = createApp({ environment: 'server', mode: 'production' })
    expect(app.isServer).toBe(true)
    expect(app.isClient).toBe(false)
    expect(app.isProduction).toBe(true)
    expect(app.isDevelopment).toBe(false)
    expect(createApp({ environment: 'client', mode: 'development' }).isDevelopment).toBe(true)
  })

  it('moves through created → booted → ready → shutdown', async () => {
    const app = createApp()
    expect(app.status).toBe('created')
    await app.boot()
    expect(app.status).toBe('booted')
    await app.ready()
    expect(app.status).toBe('ready')
    await app.shutdown()
    expect(app.status).toBe('shutdown')
  })

  it('boots once even when called concurrently', async () => {
    const register = vi.fn()
    const app = createApp({ providers: [defineProvider({ name: 'p', register })] })
    const [a, b] = await Promise.all([app.boot(), app.boot()])
    expect(a).toBe(b)
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('resolves container bindings between register and boot', async () => {
    const seen: unknown[] = []
    const app = createApp({
      providers: [
        defineProvider({
          name: 'svc',
          register: (a) => void a.container.singleton('svc', async () => 'ready'),
          boot: (a) => void seen.push(a.container.use('svc')),
        }),
      ],
    })
    await app.boot()
    expect(seen).toEqual(['ready'])
  })

  it('runs ready in order and shutdown in reverse order', async () => {
    const log: string[] = []
    const make = (name: string) =>
      defineProvider({
        name,
        ready: () => void log.push(`${name}.ready`),
        shutdown: () => void log.push(`${name}.shutdown`),
      })
    const app = createApp({ providers: [make('a'), make('b'), make('c')] })
    await app.ready()
    await app.shutdown()
    expect(log).toEqual(['a.ready', 'b.ready', 'c.ready', 'c.shutdown', 'b.shutdown', 'a.shutdown'])
  })

  it('accepts providers added with use() before boot, and refuses after', async () => {
    const app = createApp()
    app.use(defineProvider({ name: 'late' }))
    await app.boot()
    expect(app.providers.map((p) => p.name)).toEqual(['late'])
    expect(() => app.use(defineProvider({ name: 'too-late' }))).toThrow(/before boot/)
  })

  it('surfaces a failing provider as a rejected boot', async () => {
    const app = createApp({
      providers: [
        defineProvider({
          name: 'bad',
          boot: () => {
            throw new Error('db down')
          },
        }),
      ],
    })
    await expect(app.boot()).rejects.toThrow('db down')
  })

  it('wrap() leaves the tree alone without providers', () => {
    expect(createApp().wrap('x')).toBe('x')
  })

  it('loads config from options', () => {
    const app = createApp({ config: { http: { baseUrl: 'https://api' } }, env: { A: 1 } })
    expect(app.config.get('http')).toEqual({ baseUrl: 'https://api' })
    expect(app.env).toEqual({ A: 1 })
  })
})

describe('KitrApp.fork', () => {
  it('shares providers and config, isolates container instances', async () => {
    let n = 0
    const app = createApp({
      providers: [
        defineProvider({
          name: 'counter',
          register: (a) => void a.container.singleton('requestState', () => ({ id: ++n })),
        }),
      ],
      config: { x: 1 },
    })
    await app.boot()
    const a = app.fork()
    const b = app.fork()
    a.container.value('requestState', { id: 100 })
    expect(a.container.use('requestState')).toEqual({ id: 100 })
    expect(b.container.use('requestState')).toEqual({ id: 1 })
    expect(a.config).toBe(app.config)
    expect(a.providers).toBe(app.providers)
    expect(a).toBeInstanceOf(KitrApp)
    expect(await a.boot()).toBe(a)
  })

  it('keeps environment and mode, so request apps know they run in development', () => {
    const app = createApp({ environment: 'server', mode: 'development' })
    const fork = app.fork()
    expect(fork.environment).toBe('server')
    expect(fork.mode).toBe('development')
    expect(fork.isDevelopment).toBe(true)
    expect(fork.status).toBe(app.status)
  })
})

describe('providers', () => {
  it('resolves plain, lazy and default-exported providers', async () => {
    const p = defineProvider({ name: 'p' })
    expect(await resolveProvider(p)).toBe(p)
    expect(await resolveProvider(() => p)).toBe(p)
    expect(await resolveProvider(async () => ({ default: p }))).toBe(p)
  })
})

describe('getDevtools', () => {
  it('is null unless the devtools hub is bound', () => {
    const app = createApp()
    expect(getDevtools(app)).toBeNull()
    const hub = { panels: [] } as any
    app.container.value('devtools', hub)
    expect(getDevtools(app)).toBe(hub)
  })
})
