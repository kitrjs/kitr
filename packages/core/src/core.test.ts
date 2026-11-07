import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { Container } from './container'
import { createKeys, keyMatches, mergeEffects } from './contract'
import { createEnv, env } from './env'
import { KitrError, toKitrError } from './errors'
import { defineProvider } from './provider'
import { schemaFrom, validate } from './schema'

describe('Container', () => {
  it('resolves lazy singletons once', async () => {
    const c = new Container()
    let calls = 0
    c.singleton('counter', () => ++calls)
    expect(await c.make('counter')).toBe(1)
    expect(c.use('counter')).toBe(1)
    expect(calls).toBe(1)
  })
  it('children inherit parents', async () => {
    const c = new Container().value('a', 1)
    const child = c.child()
    expect(child.use('a')).toBe(1)
    child.value('a', 2)
    expect(child.use('a')).toBe(2)
    expect(c.use('a')).toBe(1)
  })
  it('refuses sync use of async factory', () => {
    const c = new Container().singleton('x', async () => 1)
    expect(() => c.use('x')).toThrow(/async factory/)
  })
})

describe('KitrApp', () => {
  it('runs register, boot, wrap in order', async () => {
    const log: string[] = []
    const app = createApp({
      environment: 'test',
      providers: [
        defineProvider({
          name: 'a',
          register: () => void log.push('a.register'),
          boot: () => void log.push('a.boot'),
          wrap: (c) => `A(${c})`,
        }),
        async () => ({
          default: defineProvider({
            name: 'b',
            register: () => void log.push('b.register'),
            wrap: (c) => `B(${c})`,
          }),
        }),
      ],
    })
    await app.boot()
    expect(log).toEqual(['a.register', 'b.register', 'a.boot'])
    expect(app.wrap('x')).toBe('A(B(x))')
  })
})

describe('KitrError', () => {
  it('normalises', () => {
    expect(toKitrError(new Error('boom')).code).toBe('INTERNAL')
    expect(toKitrError({ code: 'NOT_FOUND', message: 'nope', status: 404 }).status).toBe(404)
    expect(KitrError.validation({ email: ['bad'] }).toJSON()).toEqual({
      code: 'VALIDATION',
      message: 'Validation failed',
      status: 422,
      fieldErrors: { email: ['bad'] },
    })
  })
})

describe('env', () => {
  it('validates and splits public/server', () => {
    const e = createEnv({
      public: { VITE_API_URL: env.url() },
      server: { SECRET: env.string(), PORT: env.number({ default: 3000 }) },
      runtimeEnv: { VITE_API_URL: 'https://x.dev', SECRET: 's' },
      isClient: false,
    })
    expect(e.VITE_API_URL).toBe('https://x.dev')
    expect(e.PORT).toBe(3000)
    expect(() =>
      createEnv({ server: { SECRET: env.string() }, runtimeEnv: {}, isClient: false }),
    ).toThrow(/SECRET/)
    const client = createEnv({
      public: { VITE_A: env.string() },
      server: { SECRET: env.string() },
      runtimeEnv: { VITE_A: '1' },
      isClient: true,
    })
    expect(() => client.SECRET).toThrow(/server-only/)
  })
})

describe('contract', () => {
  it('keys and matching', () => {
    const k = createKeys('projects')
    expect(k.detail(1)).toEqual(['projects', 'detail', 1])
    expect(keyMatches(k.all, k.detail(1))).toBe(true)
    expect(keyMatches(k.detail(2), k.detail(1))).toBe(false)
    expect(mergeEffects({ invalidate: [k.all] }, undefined, { invalidate: [k.lists()] })).toEqual({
      invalidate: [['projects'], ['projects', 'list']],
    })
  })
  it('validates standard schemas', async () => {
    const s = schemaFrom((v: unknown) => {
      if (typeof v !== 'string') throw new Error('expected string')
      return v.toUpperCase()
    })
    expect(await validate(s, 'a')).toEqual({ success: true, data: 'A' })
    expect(await validate(s, 1)).toEqual({
      success: false,
      fieldErrors: { _root: ['expected string'] },
    })
  })
})
