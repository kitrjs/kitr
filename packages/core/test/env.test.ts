import { describe, expect, it } from 'vitest'
import { createEnv, env } from '../src/env'
import { schemaFrom } from '../src/schema'

const run = (schema: ReturnType<typeof env.string>, value: unknown) =>
  schema['~standard'].validate(value)

describe('env schemas', () => {
  it('string: required, optional and default', () => {
    expect(run(env.string(), 'x')).toEqual({ value: 'x' })
    expect(run(env.string(), undefined)).toMatchObject({ issues: [{ message: 'required' }] })
    expect(run(env.string({ optional: true }), undefined)).toEqual({ value: undefined })
    expect(run(env.string({ default: 'd' }), undefined)).toEqual({ value: 'd' })
  })

  it('number coerces and rejects NaN', () => {
    expect(run(env.number(), '42')).toEqual({ value: 42 })
    expect(run(env.number({ default: 1 }), undefined)).toEqual({ value: 1 })
    expect(run(env.number(), 'abc')).toMatchObject({ issues: [{ message: /expected a number/ }] })
  })

  it.each([
    ['1', true],
    ['TRUE', true],
    ['yes', true],
    ['on', true],
    ['0', false],
    ['false', false],
    ['No', false],
    ['off', false],
  ])('boolean parses %s', (raw, expected) => {
    expect(run(env.boolean(), raw)).toEqual({ value: expected })
  })

  it('boolean rejects junk and uses defaults', () => {
    expect(run(env.boolean(), 'maybe')).toHaveProperty('issues')
    expect(run(env.boolean({ default: false }), undefined)).toEqual({ value: false })
    expect(run(env.boolean(), undefined)).toHaveProperty('issues')
  })

  it('url validates', () => {
    expect(run(env.url(), 'https://a.dev')).toEqual({ value: 'https://a.dev' })
    expect(run(env.url(), 'not a url')).toHaveProperty('issues')
    expect(run(env.url({ optional: true }), undefined)).toEqual({ value: undefined })
  })

  it('enum restricts values', () => {
    const level = env.enum(['debug', 'info'] as const, { default: 'info' })
    expect(level['~standard'].validate('debug')).toEqual({ value: 'debug' })
    expect(level['~standard'].validate(undefined)).toEqual({ value: 'info' })
    expect(level['~standard'].validate('loud')).toMatchObject({
      issues: [{ message: 'expected one of debug, info' }],
    })
  })
})

describe('createEnv', () => {
  it('treats empty strings as missing', () => {
    const e = createEnv({
      server: { PORT: env.number({ default: 3000 }) },
      runtimeEnv: { PORT: '' },
      isClient: false,
    })
    expect(e.PORT).toBe(3000)
  })

  it('lists every invalid variable in one error', () => {
    expect(() =>
      createEnv({
        public: { VITE_URL: env.url() },
        server: { SECRET: env.string(), PORT: env.number() },
        runtimeEnv: { VITE_URL: 'nope', PORT: 'x' },
        isClient: false,
      }),
    ).toThrowError(/VITE_URL[\s\S]*SECRET[\s\S]*PORT/)
  })

  it('refuses public variables without the client prefix', () => {
    expect(() =>
      createEnv({ public: { API_URL: env.string() }, runtimeEnv: {}, isClient: false }),
    ).toThrow(/must start with "VITE_"/)
    expect(
      createEnv({
        public: { PUBLIC_API: env.string() },
        clientPrefix: 'PUBLIC_',
        runtimeEnv: { PUBLIC_API: 'x' },
        isClient: true,
      }).PUBLIC_API,
    ).toBe('x')
  })

  it('skips server validation in the browser and blocks reads there', () => {
    const e = createEnv({
      public: { VITE_NAME: env.string() },
      server: { SECRET: env.string() },
      runtimeEnv: { VITE_NAME: 'app' },
      isClient: true,
    })
    expect(e.VITE_NAME).toBe('app')
    expect(() => (e as any).SECRET).toThrow(/server-only/)
  })

  it('skip: true bypasses validation', () => {
    const e = createEnv({ server: { SECRET: env.string() }, runtimeEnv: {}, skip: true })
    expect(e.SECRET).toBeUndefined()
  })

  it('rejects async schemas', () => {
    const asyncSchema = {
      '~standard': { version: 1, vendor: 'x', validate: async () => ({ value: 1 }) },
    } as any
    expect(() =>
      createEnv({ server: { A: asyncSchema }, runtimeEnv: { A: '1' }, isClient: false }),
    ).toThrow(/synchronous/)
  })

  it('reads process.env by default', () => {
    process.env.KITR_TEST_VALUE = 'from-process'
    const e = createEnv({ server: { KITR_TEST_VALUE: env.string() }, isClient: false })
    expect(e.KITR_TEST_VALUE).toBe('from-process')
    delete process.env.KITR_TEST_VALUE
  })

  it('works with any Standard Schema', () => {
    const upper = schemaFrom((v: unknown) => String(v).toUpperCase())
    const e = createEnv({ server: { MODE: upper }, runtimeEnv: { MODE: 'dev' }, isClient: false })
    expect(e.MODE).toBe('DEV')
  })
})
