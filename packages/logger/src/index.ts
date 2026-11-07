import { createDefineConfig, defineProvider, getDevtools } from '@kitr/core'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'
const levels: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
}

export interface LogRecord {
  level: LogLevel
  time: string
  name?: string
  msg: string
  [key: string]: unknown
}

export interface LoggerOptions {
  level?: LogLevel
  name?: string
  /** 'pretty' for terminals, 'json' for production. Default: pretty in dev, json otherwise. */
  format?: 'pretty' | 'json'
  /** Fields merged into every record (e.g. requestId). */
  bindings?: Record<string, unknown>
  /** Where lines go. Default: console. */
  write?: (line: string, record: LogRecord) => void
}

export interface Logger {
  level: LogLevel
  trace(msg: string, fields?: Record<string, unknown>): void
  debug(msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string | Error, fields?: Record<string, unknown>): void
  fatal(msg: string | Error, fields?: Record<string, unknown>): void
  child(bindings: Record<string, unknown>, name?: string): Logger
  /** Time an async operation and log its duration. */
  time<T>(msg: string, fn: () => Promise<T>, fields?: Record<string, unknown>): Promise<T>
}

const colors: Record<LogLevel, string> = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
  silent: '',
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const isDev = (globalThis as any).process?.env?.NODE_ENV !== 'production'
  const format = options.format ?? (isDev ? 'pretty' : 'json')
  const write =
    options.write ??
    ((line: string, record: LogRecord) => {
      if (levels[record.level] >= levels.error) console.error(line)
      else console.log(line)
    })

  const build = (
    bindings: Record<string, unknown>,
    name?: string,
    level: LogLevel = options.level ?? 'info',
  ): Logger => {
    const emit = (lvl: LogLevel, msg: string | Error, fields?: Record<string, unknown>) => {
      if (levels[lvl] < levels[logger.level]) return
      const record: LogRecord = {
        level: lvl,
        time: new Date().toISOString(),
        ...(name ? { name } : {}),
        ...withoutReserved(bindings),
        ...withoutReserved(fields),
        msg: '',
      }
      if (msg instanceof Error) {
        record.msg = msg.message
        record.err = {
          name: msg.name,
          message: msg.message,
          stack: msg.stack,
          ...((msg as any).code ? { code: (msg as any).code } : {}),
        }
      } else record.msg = msg
      write(format === 'json' ? JSON.stringify(record) : pretty(record), record)
    }
    const logger: Logger = {
      level,
      trace: (m, f) => emit('trace', m, f),
      debug: (m, f) => emit('debug', m, f),
      info: (m, f) => emit('info', m, f),
      warn: (m, f) => emit('warn', m, f),
      error: (m, f) => emit('error', m, f),
      fatal: (m, f) => emit('fatal', m, f),
      child: (extra, childName) =>
        build({ ...bindings, ...extra }, childName ?? name, logger.level),
      time: async (msg, fn, fields) => {
        const start = performance.now()
        try {
          return await fn()
        } finally {
          emit('info', msg, { ...fields, durationMs: Math.round(performance.now() - start) })
        }
      },
    }
    return logger
  }
  return build(options.bindings ?? {}, options.name)
}

const reserved = new Set(['level', 'time', 'msg'])

/** Fields may not overwrite `level`, `time` or `msg`: filtering and formatting rely on them. */
function withoutReserved(fields?: Record<string, unknown>): Record<string, unknown> {
  if (!fields) return {}
  let out: Record<string, unknown> | undefined
  for (const key of Object.keys(fields)) {
    if (!reserved.has(key)) continue
    out ??= { ...fields }
    delete out[key]
  }
  return out ?? fields
}

function pretty(r: LogRecord): string {
  const { level, time, name, msg, err, ...rest } = r
  const tag = `${colors[level]}${level.toUpperCase().padEnd(5)}\x1b[0m`
  const extras = Object.keys(rest).length ? ` \x1b[90m${JSON.stringify(rest)}\x1b[0m` : ''
  const stack = err && typeof err === 'object' && 'stack' in err ? `\n${(err as any).stack}` : ''
  return `${tag} \x1b[90m${time.slice(11, 23)}\x1b[0m ${name ? `[${name}] ` : ''}${msg}${extras}${stack}`
}

export type LoggerConfig = LoggerOptions

declare module '@kitr/core' {
  interface ConfigRegistry {
    logger: LoggerConfig
  }
  interface ContainerBindings {
    logger: Logger
  }
}

export const defineConfig = createDefineConfig<LoggerConfig>()

/** Binds `logger` into the container from `config/logger.ts`. */
export const loggerProvider = defineProvider({
  name: 'logger',
  register(app) {
    app.container.singleton('logger', () => {
      const config = app.config.get('logger', {})
      const hub = getDevtools(app)
      if (!hub) return createLogger(config)
      // Development: every record also lands in the devtools Log panel under "logger".
      const write = config.write ?? ((line: string) => console.log(line))
      return createLogger({
        ...config,
        write: (line, record) => {
          write(line, record)
          const { level, msg, time, name, ...fields } = record
          hub.log('logger', msg, Object.keys(fields).length ? fields : undefined, levelOf(level))
        },
      })
    })
  },
})

function levelOf(level: LogLevel): 'debug' | 'info' | 'warn' | 'error' {
  if (level === 'trace' || level === 'debug') return 'debug'
  if (level === 'warn') return 'warn'
  if (level === 'error' || level === 'fatal') return 'error'
  return 'info'
}

export default loggerProvider

/** A logger that discards everything, for tests. */
export const silentLogger = createLogger({ level: 'silent', write: () => {} })
