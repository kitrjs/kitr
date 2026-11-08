/**
 * The pieces every kitr data client shares: `http` (external APIs), `api` (kitr routes), `actions`
 * (Start server functions) and `realtime`. One error envelope, one query key factory, one abort
 * plumbing and one header injection, so the four clients cannot drift apart.
 */
import type { QueryKey } from './contract'
import { KitrError, type KitrErrorShape, toKitrError } from './errors'

// -- Error envelope ----------------------------------------------------------------------------

/** What a server function returns: the data, or the wire shape of the error. */
export type Envelope<T> = { ok: true; data: T } | { ok: false; error: KitrErrorShape }

/** Options for `toEnvelope`. */
export interface ToEnvelopeOptions {
  /**
   * Hide a server error's message and data (status 500 and up), for production responses. The
   * original stays in the server log; the browser sees `Internal server error`.
   */
  mask?: boolean
}

/** Any thrown value as the plain wire shape of a `KitrError`: code, status, message, field errors, data. */
export function toEnvelope(error: unknown, options: ToEnvelopeOptions = {}): KitrErrorShape {
  const shape = toKitrError(error).toJSON()
  if (options.mask && shape.status >= 500) {
    shape.message = 'Internal server error'
    shape.data = undefined
  }
  return shape
}

/** Options for `fromEnvelope`. */
export interface FromEnvelopeOptions {
  /** Kept as the error's `cause`, e.g. the HTTP error the body came from. */
  cause?: unknown
}

/**
 * A response body (or any decoded JSON) as a `KitrError`. A kitr wire shape round-trips with its
 * code, status, message, field errors and data. Anything else is read the way other backends write
 * errors: `{ message }`, `{ error: { message } }`, `{ error: 'text' }` and
 * `{ errors: [{ field, message }] }` (Adonis, VineJS); `status` picks the code.
 */
export function fromEnvelope(
  json: unknown,
  status = 500,
  options: FromEnvelopeOptions = {},
): KitrError {
  if (isShape(json)) {
    return new KitrError(json.code, json.message, {
      status: json.status || status,
      fieldErrors: json.fieldErrors,
      data: json.data,
      cause: options.cause,
    })
  }
  const body = (json ?? {}) as Record<string, any>
  const raw = body.message ?? body.error?.message ?? body.error
  const message = typeof raw === 'string' ? raw : undefined
  const fieldErrors = Array.isArray(body.errors) ? groupIssues(body.errors) : undefined
  const base = KitrError.fromStatus(status, message, json)
  return new KitrError(base.code, base.message, {
    status,
    fieldErrors,
    data: json,
    cause: options.cause,
  })
}

function isShape(value: unknown): value is KitrErrorShape {
  const v = value as Partial<KitrErrorShape> | null
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.code === 'string' &&
    typeof v.message === 'string' &&
    typeof v.status === 'number'
  )
}

function groupIssues(issues: unknown[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const i = (issue ?? {}) as { field?: string; path?: string; message?: string }
    const field = i.field ?? i.path ?? '_root'
    const list = out[field] ?? []
    list.push(i.message ?? String(issue))
    out[field] = list
  }
  return out
}

/** A successful envelope. */
export const okEnvelope = <T>(data: T): Envelope<T> => ({ ok: true, data })

/** A failed envelope for anything thrown. */
export const failEnvelope = (error: unknown, options?: ToEnvelopeOptions): Envelope<never> => ({
  ok: false,
  error: toEnvelope(error, options),
})

/** The data of an envelope, or the `KitrError` it carries thrown. */
export function unwrapEnvelope<T>(envelope: Envelope<T>): T {
  if (envelope.ok) return envelope.data
  throw fromEnvelope(envelope.error, envelope.error.status)
}

// -- Query keys --------------------------------------------------------------------------------

/**
 * The query key for a named operation: `[source, name, ...parts]`. Objects inside the parts are
 * written with their keys sorted and `undefined` properties dropped, and trailing `undefined`
 * parts are left out, so two calls with equal input always give equal keys.
 *
 *   keyFor('action', 'projects.list')              // ['action', 'projects.list']
 *   keyFor('api', 'projects.show', { id: 1 }, {})  // ['api', 'projects.show', { id: 1 }, {}]
 */
export function keyFor(source: string, name: string, ...parts: unknown[]): QueryKey {
  let end = parts.length
  while (end > 0 && parts[end - 1] === undefined) end--
  return [source, name, ...parts.slice(0, end).map(canonical)]
}

/** A stable string for a key (or any value): sorted object keys, so it can be a map key or a hash input. */
export function serializeKey(key: unknown): string {
  return JSON.stringify(canonical(key))
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[k]
      if (v !== undefined) out[k] = canonical(v)
    }
    return out
  }
  return value
}

// -- Abort signals -----------------------------------------------------------------------------

/**
 * One signal that aborts when any of the given ones does (with that one's reason). Missing
 * signals are skipped; with none, the result never aborts.
 */
export function linkSignals(...signals: Array<AbortSignal | null | undefined>): AbortSignal {
  const live = signals.filter((s): s is AbortSignal => !!s)
  if (live.length === 0) return new AbortController().signal
  if (live.length === 1) return live[0]!
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(live)
  const controller = new AbortController()
  for (const s of live) {
    if (s.aborted) {
      controller.abort(s.reason)
      break
    }
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true })
  }
  return controller.signal
}

/** A signal that aborts after `ms` with a `TimeoutError`, which `toKitrError` reads as `TIMEOUT`. */
export function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms)
}

/** `linkSignals` for a caller's signal plus an optional timeout in milliseconds. */
export function withTimeout(signal?: AbortSignal | null, ms?: number): AbortSignal {
  return linkSignals(signal, ms !== undefined && ms > 0 ? timeoutSignal(ms) : undefined)
}

// -- Headers -----------------------------------------------------------------------------------

/** The value of a cookie, URI-decoded; undefined when absent. Reads `document.cookie` unless a cookie string is given. */
export function readCookie(name: string, cookies?: string): string | undefined {
  const source = cookies ?? (typeof document === 'undefined' ? undefined : document.cookie)
  if (!source) return undefined
  for (const part of source.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

/** The names `@kitr/shield`'s double-submit check uses; `false` turns the echo off. */
export type CsrfOption = false | { cookie?: string; header?: string }

/** Options for `applyRequestHeaders`. */
export interface RequestHeaderOptions {
  /** The HTTP method; the CSRF echo is added to writes only. */
  method: string
  /** A bearer token, or nothing. */
  token?: string | null
  /** Header for the token. Default `Authorization`, sent as `Bearer <token>`; any other name carries the bare token. */
  authHeader?: string
  /** Echo the CSRF cookie on writes (browser only). On by default; `false` turns it off. */
  csrf?: CsrfOption
  /** The cookie string to read, for tests and servers; defaults to `document.cookie`. */
  cookies?: string
  /** Add `x-request-id` when absent: `true` makes a UUID, a string uses that value. */
  requestId?: boolean | string
}

/** The header value for a token: `Bearer <token>` on `Authorization`, the bare token on any other header. */
export function bearerValue(token: string, authHeader = 'Authorization'): string {
  return authHeader.toLowerCase() === 'authorization' ? `Bearer ${token}` : token
}

/**
 * The shared header injection: bearer token, CSRF cookie echo (`kitr-csrf` cookie to
 * `x-csrf-token` header, on writes, never overwriting a header the caller set) and request id.
 */
export function applyRequestHeaders(headers: Headers, options: RequestHeaderOptions): Headers {
  if (options.token) {
    const name = options.authHeader ?? 'Authorization'
    headers.set(name, bearerValue(options.token, name))
  }
  if (options.csrf !== false && !/^(GET|HEAD|OPTIONS)$/i.test(options.method)) {
    const header = options.csrf?.header ?? 'x-csrf-token'
    if (!headers.has(header)) {
      const value = readCookie(options.csrf?.cookie ?? 'kitr-csrf', options.cookies)
      if (value) headers.set(header, value)
    }
  }
  if (options.requestId && !headers.has('x-request-id')) {
    headers.set(
      'x-request-id',
      typeof options.requestId === 'string' ? options.requestId : crypto.randomUUID(),
    )
  }
  return headers
}
