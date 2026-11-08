import { createDefineConfig, defineProvider, getDevtools } from '@kitr/core'

/** A log level, lowest to highest; `silent` drops everything and is for configuration only. */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'
// kitr-allow-module-state: lookup table built once at import, never mutated
const levels: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
}

/** One log line as an object: what `write` receives and what `json` format serialises. */
export interface LogRecord {
  /** The level it was written at. */
  level: LogLevel
  /** When it was written, as an ISO 8601 string. */
  time: string
  /** The logger's name, when it has one. */
  name?: string
  /** The message, or the error's message. */
  msg: string
  /** Bindings, fields, `err` for errors and `durationMs` from `time()`. */
  [key: string]: unknown
}

/** Options for `createLogger`, and the shape of `config/logger.ts`. */
export interface LoggerOptions {
  /** The lowest level written. Default `info`. */
  level?: LogLevel
  /** Shown as `[name]` in pretty output and as `name` in JSON. */
  name?: string
  /** 'pretty' for terminals, 'json' for production. Default: pretty in dev, json otherwise. */
  format?: 'pretty' | 'json'
  /** Fields merged into every record (e.g. requestId). */
  bindings?: Record<string, unknown>
  /** Where lines go. Default: console. */
  write?: (line: string, record: LogRecord) => void
}

/** A logger: one method per level, child loggers that carry fields, and timing. Bound as `logger` by the provider. */
export interface Logger {
  /** The lowest level written. Settable at run time; children copy it when created. */
  level: LogLevel
  /** Write at `trace`: step-by-step detail. */
  trace(msg: string, fields?: Record<string, unknown>): void
  /** Write at `debug`: detail for development. */
  debug(msg: string, fields?: Record<string, unknown>): void
  /** Write at `info`: something that happened. */
  info(msg: string, fields?: Record<string, unknown>): void
  /** Write at `warn`: something odd that did not fail. */
  warn(msg: string, fields?: Record<string, unknown>): void
  /** Write at `error`. Pass an `Error` to keep its name, message, stack and code under `err`. */
  error(msg: string | Error, fields?: Record<string, unknown>): void
  /** Write at `fatal`. Pass an `Error` to keep its name, message, stack and code under `err`. */
  fatal(msg: string | Error, fields?: Record<string, unknown>): void
  /** A logger that adds `bindings` to every record, optionally under another name. */
  child(bindings: Record<string, unknown>, name?: string): Logger
  /** Run `fn`, then log `msg` at info with `durationMs`, even when it throws; returns its result. */
  time<T>(msg: string, fn: () => Promise<T>, fields?: Record<string, unknown>): Promise<T>
}

// kitr-allow-module-state: lookup table built once at import, never mutated
const colors: Record<LogLevel, string> = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
  silent: '',
}

/** Create a logger without the provider, for scripts, packages and tests. */
export function createLogger(options: LoggerOptions = {}): Logger {
  const isDev = (globalThis as any).process?.env?.NODE_ENV !== 'production'
  // A browser console shows neither ANSI colours nor wants JSON strings: it gets the message and
  // the fields as an object, at the matching console level, unless a format or writer is chosen.
  const inBrowser =
    typeof (globalThis as any).window !== 'undefined' &&
    typeof (globalThis as any).document !== 'undefined'
  const browserConsole = inBrowser && !options.format && !options.write
  const format = options.format ?? (isDev ? 'pretty' : 'json')
  const write =
    options.write ??
    (browserConsole
      ? (_line: string, record: LogRecord) => browserWrite(record)
      : (line: string, record: LogRecord) => {
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

const reserved = new Set(['level', 'time', 'msg']) // kitr-allow-module-state: constant set built once at import, never mutated

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

function browserWrite(r: LogRecord) {
  const { level, time: _time, name, msg, ...rest } = r
  const method =
    level === 'error' || level === 'fatal'
      ? 'error'
      : level === 'warn'
        ? 'warn'
        : level === 'info'
          ? 'info'
          : 'debug'
  const text = `${name ? `[${name}] ` : ''}${msg}`
  if (Object.keys(rest).length) console[method](text, rest)
  else console[method](text)
}

function pretty(r: LogRecord): string {
  const { level, time, name, msg, err, ...rest } = r
  const tag = `${colors[level]}${level.toUpperCase().padEnd(5)}\x1b[0m`
  const extras = Object.keys(rest).length ? ` \x1b[90m${JSON.stringify(rest)}\x1b[0m` : ''
  const stack = err && typeof err === 'object' && 'stack' in err ? `\n${(err as any).stack}` : ''
  return `${tag} \x1b[90m${time.slice(11, 23)}\x1b[0m ${name ? `[${name}] ` : ''}${msg}${extras}${stack}`
}

/** The options in `config/logger.ts`; the same as `LoggerOptions`. */
export type LoggerConfig = LoggerOptions

declare module '@kitr/core' {
  interface ConfigRegistry {
    logger: LoggerConfig
  }
  interface ContainerBindings {
    logger: Logger
  }
}

/** Types `config/logger.ts`. Returns its argument unchanged. */
export const defineConfig = createDefineConfig<LoggerConfig>()

/**
 * Binds `logger` into the container from `config/logger.ts`, on the server and in the browser.
 * In development with devtools, every record is also mirrored to the Log panel.
 */
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
