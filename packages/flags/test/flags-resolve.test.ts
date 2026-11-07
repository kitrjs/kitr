import { createApp } from '@kitr/core'
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createFlags,
  defineFlags,
  envFlagsProvider,
  type FlagsProvider,
  percentageFlagsProvider,
  staticFlagsProvider,
} from '../src'
import flagsProvider from '../src/provider'
import { flagsScript, resolveFlags } from '../src/server'

const definitions = defineFlags({
  beta: { default: false },
  pageSize: { default: 20 },
  theme: { default: 'classic' },
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('type coercion', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['on', true],
    ['yes', true],
    ['false', false],
    ['0', false],
    ['off', false],
    ['no', false],
  ])('reads %j as boolean %s', async (raw, expected) => {
    const f = createFlags(definitions, { providers: [envFlagsProvider({ FLAG_BETA: raw })] })
    expect((await f.resolve()).beta).toBe(expected)
  })

  it('ignores answers that are not the declared type, falling through to the next provider', async () => {
    const f = createFlags(definitions, {
      providers: [
        envFlagsProvider({ FLAG_BETA: 'maybe', FLAG_PAGE_SIZE: 'lots', FLAG_THEME: 'env' }),
        staticFlagsProvider({ beta: true, pageSize: 50 }),
      ],
    })
    expect(await f.resolve()).toEqual({ beta: true, pageSize: 50, theme: 'env' })
  })

  it('falls back to the default for unreadable numbers, never NaN', async () => {
    for (const raw of ['', ' ', 'NaN', 'Infinity', '12px']) {
      const f = createFlags(definitions, { providers: [envFlagsProvider({ FLAG_PAGE_SIZE: raw })] })
      expect((await f.resolve()).pageSize).toBe(20)
    }
    const ok = createFlags(definitions, {
      providers: [envFlagsProvider({ FLAG_PAGE_SIZE: ' 7.5 ' })],
    })
    expect((await ok.resolve()).pageSize).toBe(7.5)
  })

  it('turns numbers into booleans and strings where declared', async () => {
    const f = createFlags(definitions, {
      providers: [staticFlagsProvider({ beta: 1, theme: 3, pageSize: true as never })],
    })
    expect(await f.resolve()).toEqual({ beta: true, pageSize: 20, theme: '3' })
  })
})

describe('provider failures', () => {
  it('skips a provider that throws and uses the next one', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken: FlagsProvider = {
      name: 'broken',
      resolve: () => {
        throw new Error('network')
      },
    }
    const f = createFlags(definitions, { providers: [broken, staticFlagsProvider({ beta: true })] })
    expect(await f.resolve()).toEqual({ beta: true, pageSize: 20, theme: 'classic' })
    expect(console.warn).toHaveBeenCalled()
  })

  it('skips a provider whose init fails, and resolves the rest', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const resolve = vi.fn(() => true)
    const f = createFlags(definitions, {
      providers: [
        { name: 'cold', init: () => Promise.reject(new Error('down')), resolve },
        staticFlagsProvider({ theme: 'warm' }),
      ],
    })
    expect(await f.resolve()).toEqual({ beta: false, pageSize: 20, theme: 'warm' })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('async providers and context-dependent answers work', async () => {
    const f = createFlags(definitions, {
      providers: [
        {
          name: 'remote',
          resolve: async (key, ctx) => (key === 'beta' ? ctx.plan === 'pro' : undefined),
        },
      ],
    })
    expect((await f.resolve({ plan: 'pro' })).beta).toBe(true)
    expect((await f.resolve({ plan: 'free' })).beta).toBe(false)
  })
})

describe('hydrate', () => {
  it('keeps declared keys only, coerced to their types', () => {
    const f = createFlags(definitions)
    f.hydrate({
      beta: 'true',
      pageSize: '30',
      theme: 5,
      evil: 'x',
      __proto__: { polluted: true },
    } as never)
    expect(f.snapshot()).toEqual({ beta: true, pageSize: 30, theme: '5' })
    expect(({} as any).polluted).toBeUndefined()
    f.hydrate({ pageSize: 'oops', beta: null } as never)
    expect(f.snapshot()).toEqual({ beta: false, pageSize: 20, theme: 'classic' })
  })
})

describe('snapshot', () => {
  it('is stable between changes and frozen', async () => {
    const f = createFlags(definitions, { providers: [staticFlagsProvider({ beta: true })] })
    const before = f.snapshot()
    expect(f.snapshot()).toBe(before)
    expect(Object.isFrozen(before)).toBe(true)
    await f.resolve()
    const after = f.snapshot()
    expect(after).not.toBe(before)
    expect(f.snapshot()).toBe(after)
    const returned = await f.resolve()
    ;(returned as any).beta = 'changed'
    expect(f.value('beta')).toBe(true)
  })
})

describe('percentage rollout', () => {
  it('is stable per user, 0% is nobody, 100% is everybody', async () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `user-${i}`)
    const p = percentageFlagsProvider({ beta: 25, none: 0, all: 100 })
    let on = 0
    for (const id of ids) {
      const a = p.resolve('beta', { userId: id })
      expect(p.resolve('beta', { userId: id })).toBe(a)
      if (a) on++
      expect(p.resolve('none', { userId: id })).toBe(false)
      expect(p.resolve('all', { userId: id })).toBe(true)
    }
    expect(on / ids.length).toBeGreaterThan(0.2)
    expect(on / ids.length).toBeLessThan(0.3)
    expect(p.resolve('beta', {})).toBe(false)
    expect(p.resolve('other', { userId: 'x' })).toBeUndefined()
  })

  it('different salts and flags roll out to different users', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `u${i}`)
    const a = percentageFlagsProvider({ x: 50 }, 'a')
    const b = percentageFlagsProvider({ x: 50 }, 'b')
    const differ = ids.filter(
      (id) => a.resolve('x', { userId: id }) !== b.resolve('x', { userId: id }),
    )
    expect(differ.length).toBeGreaterThan(100)
  })
})

describe('env provider', () => {
  it('maps camelCase, dotted and dashed keys to FLAG_ names', () => {
    const env = {
      FLAG_NEW_DASHBOARD: 'a',
      FLAG_CHECKOUT_V2: 'b',
      FLAG_SEARCH_FAST: 'c',
      X_BETA: 'd',
    }
    const p = envFlagsProvider(env)
    expect(p.resolve('newDashboard', {})).toBe('a')
    expect(p.resolve('checkoutV2', {})).toBe('b')
    expect(p.resolve('search.fast', {})).toBe('c')
    expect(p.resolve('search-fast', {})).toBe('c')
    expect(envFlagsProvider(env, 'X_').resolve('beta', {})).toBe('d')
  })
})

describe('server', () => {
  const targeted = staticFlagsProvider((ctx) => ({ beta: ctx.userId === 'alice' }))

  it("the root app never keeps one user's answers for the next", async () => {
    const app = createApp({
      environment: 'server',
      providers: [flagsProvider],
      config: { flags: { definitions, providers: [targeted] } },
    })
    await app.boot()
    const flags = app.container.use('flags')
    expect((await flags.resolve({ userId: 'alice' })).beta).toBe(true)
    expect(flags.value('beta')).toBe(false)
    expect(flags.resolved).toBe(false)
  })

  it('each request resolves on its own fork, and value() answers for that user', async () => {
    const app = createApp({
      environment: 'server',
      providers: [flagsProvider],
      config: { flags: { definitions, providers: [targeted] } },
    })
    const server = createServer({ app, logger: silentLogger, server: { healthPath: false } })
    server.h3.use(async (event: any, next: () => unknown) => {
      event.context.kitr.locals.user = { id: event.req.headers.get('x-user') }
      return next()
    })
    server.h3.get('/flags', async (event: any) => {
      const values = await resolveFlags(app, event)
      // A slow handler: the other request resolves in between.
      await new Promise((r) => setTimeout(r, 20))
      const fork = event.context.kitr.app
      return { values, value: fork.container.use('flags').value('beta') }
    })
    await app.boot()
    const ask = (user: string) =>
      server
        .fetch(new Request('http://x/flags', { headers: { 'x-user': user } }))
        .then((r) => r.json())
    const [alice, bob] = await Promise.all([ask('alice'), ask('bob')])
    expect(alice).toEqual({ values: { beta: true, pageSize: 20, theme: 'classic' }, value: true })
    expect(bob).toEqual({ values: { beta: false, pageSize: 20, theme: 'classic' }, value: false })
    expect(app.container.use('flags').value('beta')).toBe(false)
  })

  it('resolveFlags caches per event and merges extra context', async () => {
    const resolve = vi.fn((_key: string, ctx: Record<string, unknown>) => ctx.plan === 'pro')
    const app = createApp({
      environment: 'server',
      providers: [flagsProvider],
      config: {
        flags: {
          definitions,
          providers: [
            { name: 'spy', resolve: (k, c) => (k === 'beta' ? resolve(k, c) : undefined) },
          ],
        },
      },
    })
    await app.boot()
    const event = { context: {} as Record<string, any> }
    const first = await resolveFlags(app, event, { plan: 'pro' })
    expect(first.beta).toBe(true)
    expect(await resolveFlags(app, event)).toBe(first)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('flagsScript cannot be broken out of', () => {
    const html = flagsScript({ theme: '</script><script>alert(1)</script>' })
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).toContain('\\u003c/script>')
    const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    expect(JSON.parse(json).theme).toBe('</script><script>alert(1)</script>')
  })
})

// Regression: `ttl` in config/flags.ts was read by nothing, so an open tab kept the flags it
// resolved at boot until it was reloaded.
describe('ttl', () => {
  afterEach(() => vi.useRealTimers())

  const counting = () => {
    let calls = 0
    const provider: FlagsProvider = {
      name: 'counting',
      resolve: (key, ctx) => {
        if (key === 'beta') calls++
        return key === 'theme' ? String(ctx.userId ?? 'anon') : undefined
      },
    }
    return { provider, calls: () => calls }
  }

  it('resolves again in the browser once the snapshot is ttl seconds old, same context', async () => {
    vi.useFakeTimers()
    const { provider, calls } = counting()
    const app = createApp({ environment: 'client' })
    const flags = createFlags(definitions, { providers: [provider], ttl: 60 }, app)
    await flags.resolve({ userId: 'u1' })
    expect(calls()).toBe(1)
    await vi.advanceTimersByTimeAsync(59_000)
    expect(calls()).toBe(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(calls()).toBe(2)
    expect(flags.value('theme')).toBe('u1')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls()).toBe(3)
  })

  it('never refreshes without a ttl, or on the server', async () => {
    vi.useFakeTimers()
    const a = counting()
    await createFlags(
      definitions,
      { providers: [a.provider] },
      createApp({ environment: 'client' }),
    ).resolve()
    const b = counting()
    await createFlags(
      definitions,
      { providers: [b.provider], ttl: 1 },
      createApp({ environment: 'server' }),
      { keepSnapshot: true },
    ).resolve()
    await vi.advanceTimersByTimeAsync(600_000)
    expect(a.calls()).toBe(1)
    expect(b.calls()).toBe(1)
  })
})
