import { KitrError } from '@kitr/core'
import type { HttpContext } from './context'
import type { Middleware } from './types'

/** Type a `(ctx, next)` middleware function. Returns it unchanged. */
export function defineMiddleware<P = any, Q = any, B = any>(
  middleware: Middleware<P, Q, B>,
): Middleware<P, Q, B> {
  return middleware
}

/** Options for `cors()`. */
export interface CorsOptions {
  /**
   * Allowed origins: one origin, a list, a predicate, or `'*'` for a public API. Default none, so
   * only same-origin requests (which need no CORS) get through: name the origins that may call you.
   */
  origin?: string | string[] | ((origin: string) => boolean)
  /** Methods allowed on preflight. Default GET, POST, PUT, PATCH, DELETE, OPTIONS. */
  methods?: string[]
  /** Request headers allowed on preflight. Default Content-Type, Authorization. */
  headers?: string[]
  /** Send `access-control-allow-credentials: true` for cookie requests. Default false. */
  credentials?: boolean
  /** Seconds a browser may cache the preflight. Default 600. */
  maxAge?: number
}

/** Marks middleware that answers preflight, so the router registers OPTIONS for its routes. */
export const handlesPreflight = Symbol.for('kitr.api.handlesPreflight')

/**
 * CORS for the origins you list; handles preflight. Without `origin` no cross-origin caller is
 * allowed. Throws at once for `origin: '*'` with credentials, which would let any site act as the user.
 */
export function cors(options: CorsOptions = {}): Middleware {
  const {
    origin,
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 600,
  } = options
  if (origin === '*' && credentials)
    throw new Error(
      '[kitr/api] cors({ origin: "*", credentials: true }) would let any site send requests with your users\' cookies; list the origins instead.',
    )
  const allow = (reqOrigin: string | null): string | null => {
    if (!origin) return null
    if (origin === '*') return '*'
    if (!reqOrigin) return null
    if (typeof origin === 'function') return origin(reqOrigin) ? reqOrigin : null
    const list = Array.isArray(origin) ? origin : [origin]
    return list.includes(reqOrigin) ? reqOrigin : null
  }
  const middleware: Middleware = async (ctx, next) => {
    const allowed = allow(ctx.request.header('origin'))
    if (allowed) {
      ctx.response.header('access-control-allow-origin', allowed)
      if (allowed !== '*') ctx.response.header('vary', 'Origin')
      if (credentials) ctx.response.header('access-control-allow-credentials', 'true')
    }
    if (ctx.request.method === 'OPTIONS') {
      ctx.response.header('access-control-allow-methods', methods.join(', '))
      ctx.response.header('access-control-allow-headers', headers.join(', '))
      ctx.response.header('access-control-max-age', String(maxAge))
      return ctx.response.noContent()
    }
    return next()
  }
  return Object.assign(middleware, { [handlesPreflight]: true })
}

/**
 * Where rate-limit counters live. The same shape as `RateLimitStore` in `kitr/shield`, so
 * `createRedisRateLimitStore` from there plugs in here too.
 */
export interface RateLimitStore {
  /** Increment and return the count and when the window resets (ms epoch). */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>
}

/** Options for `rateLimit()`. */
export interface RateLimitOptions {
  /** Window length in ms. Default 60 000. */
  windowMs?: number
  /** Max requests per key per window. Default 100. */
  max?: number
  /** Key a request; default is the client IP. */
  key?: (ctx: HttpContext) => string
  /**
   * Where counters live. Default: this process, so each instance counts on its own. Pass
   * `createRedisRateLimitStore(redis)` from `kitr/shield` to share one limit across instances.
   */
  store?: RateLimitStore
}

/** The default store: fixed windows per key in this process, pruned past 10,000 keys. */
function memoryStore(): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: number }>()
  return {
    async hit(key, windowMs) {
      const now = Date.now()
      let bucket = buckets.get(key)
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs }
        buckets.set(key, bucket)
        if (buckets.size > 10_000)
          for (const [bk, b] of buckets) if (b.resetAt <= now) buckets.delete(bk)
      }
      bucket.count++
      return { count: bucket.count, resetAt: bucket.resetAt }
    },
  }
}

/** Fixed-window rate limit per key, with `RateLimit-*` headers and a 429 past `max`. Counts in this process unless you pass a shared `store`. */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
  const {
    windowMs = 60_000,
    max = 100,
    key = (ctx) => ctx.request.ip() ?? 'unknown',
    store = memoryStore(),
  } = options
  return async (ctx, next) => {
    const { count, resetAt } = await store.hit(key(ctx), windowMs)
    const reset = String(Math.max(0, Math.ceil((resetAt - Date.now()) / 1000)))
    ctx.response.header('ratelimit-limit', String(max))
    ctx.response.header('ratelimit-remaining', String(Math.max(0, max - count)))
    ctx.response.header('ratelimit-reset', reset)
    if (count > max) {
      ctx.response.header('retry-after', reset)
      throw new KitrError('RATE_LIMITED', 'Too many requests')
    }
    return next()
  }
}

/** Reject requests whose `content-type` isn't one of the given types (for bodies). */
export function requireJson(): Middleware {
  return async (ctx, next) => {
    const method = ctx.request.method
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const type = ctx.request.header('content-type') ?? ''
      if (!type.includes('application/json'))
        throw new KitrError('BAD_REQUEST', 'Expected application/json')
    }
    return next()
  }
}

/** Compose middleware the Adonis way: `(ctx, next)` chain. */
export function compose(middleware: Middleware[]): Middleware {
  return (ctx, final) => {
    let index = -1
    const dispatch = async (i: number): Promise<unknown> => {
      if (i <= index) throw new Error('[kitr/api] next() called more than once')
      index = i
      const fn = middleware[i]
      if (!fn) return final()
      return fn(ctx, () => dispatch(i + 1))
    }
    return dispatch(0)
  }
}
