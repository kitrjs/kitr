import { createApp } from '@kitr/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger, type LogRecord, loggerProvider, silentLogger } from '../src'

function capture(options: Parameters<typeof createLogger>[0] = {}) {
  const lines: string[] = []
  const records: LogRecord[] = []
  const logger = createLogger({
    format: 'json',
    ...options,
    write: (line, record) => {
      lines.push(line)
      records.push(record)
    },
  })
  return { logger, lines, records }
}

afterEach(() => vi.restoreAllMocks())

describe('createLogger', () => {
  it('filters below the configured level', () => {
    const { logger, records } = capture({ level: 'warn' })
    logger.debug('no')
    logger.info('no')
    logger.warn('yes')
    logger.error('yes')
    expect(records.map((r) => r.level)).toEqual(['warn', 'error'])
  })

  it('silent drops everything', () => {
    const { logger, records } = capture({ level: 'silent' })
    logger.fatal('nothing')
    expect(records).toEqual([])
  })

  it('writes one JSON line per record with name, bindings and fields', () => {
    const { logger, lines } = capture({ name: 'api', bindings: { region: 'eu' } })
    logger.info('hello', { userId: 1 })
    const parsed = JSON.parse(lines[0]!)
    expect(parsed).toMatchObject({
      level: 'info',
      name: 'api',
      region: 'eu',
      userId: 1,
      msg: 'hello',
    })
    expect(new Date(parsed.time).toString()).not.toBe('Invalid Date')
  })

  it('keeps level, time and msg authoritative even when fields reuse those names', () => {
    const { logger, records } = capture()
    logger.info('real message', { level: 'fake', msg: 'fake', time: 'fake' })
    expect(records[0]).toMatchObject({ level: 'info', msg: 'real message' })
    expect(records[0]!.time).not.toBe('fake')
  })

  it('serialises errors with name, message, stack and code', () => {
    const { logger, records } = capture()
    logger.error(Object.assign(new Error('db down'), { code: 'ECONNREFUSED' }))
    expect(records[0]!.msg).toBe('db down')
    expect(records[0]!.err).toMatchObject({
      name: 'Error',
      message: 'db down',
      code: 'ECONNREFUSED',
    })
    expect((records[0]!.err as any).stack).toContain('db down')
  })

  it('child loggers inherit bindings, name and level', () => {
    const { logger, records } = capture({ name: 'root', level: 'debug', bindings: { a: 1 } })
    const child = logger.child({ requestId: 'r1' })
    child.debug('x')
    const named = logger.child({ b: 2 }, 'worker')
    named.info('y')
    expect(records[0]).toMatchObject({ name: 'root', a: 1, requestId: 'r1' })
    expect(records[1]).toMatchObject({ name: 'worker', a: 1, b: 2 })
    expect(child.level).toBe('debug')
  })

  it('changing level at runtime takes effect', () => {
    const { logger, records } = capture({ level: 'info' })
    logger.debug('hidden')
    logger.level = 'debug'
    logger.debug('shown')
    expect(records.map((r) => r.msg)).toEqual(['shown'])
  })

  it('time() logs the duration even when the task fails', async () => {
    const { logger, records } = capture()
    await expect(logger.time('ok', async () => 42)).resolves.toBe(42)
    await expect(
      logger.time('fails', async () => {
        throw new Error('x')
      }),
    ).rejects.toThrow('x')
    expect(records.map((r) => r.msg)).toEqual(['ok', 'fails'])
    expect(typeof records[0]!.durationMs).toBe('number')
  })

  it('pretty format is human readable and includes extras and stacks', () => {
    const { logger, lines } = capture({ format: 'pretty', name: 'web' })
    logger.warn('careful', { n: 1 })
    logger.error(new Error('kaboom'))
    expect(lines[0]).toContain('WARN')
    expect(lines[0]).toContain('[web] careful')
    expect(lines[0]).toContain('{"n":1}')
    expect(lines[1]).toContain('kaboom')
    expect(lines[1]).toContain('at ')
  })

  it('defaults to console, routing errors to stderr', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ format: 'json' })
    logger.info('out')
    logger.error('bad')
    expect(log).toHaveBeenCalledTimes(1)
    expect(err).toHaveBeenCalledTimes(1)
  })

  it('silentLogger never writes', () => {
    const log = vi.spyOn(console, 'log')
    silentLogger.fatal('x')
    expect(log).not.toHaveBeenCalled()
  })
})

describe('loggerProvider', () => {
  it('binds a logger from config/logger.ts', async () => {
    const records: LogRecord[] = []
    const app = createApp({
      providers: [loggerProvider],
      config: {
        logger: {
          level: 'debug',
          format: 'json',
          write: (_: string, r: LogRecord) => void records.push(r),
        },
      },
    })
    await app.boot()
    app.container.use('logger').debug('booted')
    expect(records[0]!.msg).toBe('booted')
  })

  it('mirrors records into the devtools hub when present', async () => {
    const entries: unknown[] = []
    const app = createApp({
      providers: [loggerProvider],
      config: { logger: { format: 'json', write: () => {} } },
    })
    app.container.value('devtools', { log: (...args: unknown[]) => entries.push(args) } as any)
    await app.boot()
    const logger = app.container.use('logger')
    logger.warn('slow', { ms: 900 })
    logger.fatal('dead')
    logger.info('plain')
    expect(entries).toEqual([
      ['logger', 'slow', { ms: 900 }, 'warn'],
      ['logger', 'dead', undefined, 'error'],
      ['logger', 'plain', undefined, 'info'],
    ])
  })
})
