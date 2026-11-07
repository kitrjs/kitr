import { KitrError } from '@kitr/core'
import type { HttpContext } from './context'
import type { Middleware } from './types'

export function defineMiddleware<P = any, Q = any, B = any>(
  middleware: Middleware<P, Q, B>,
): Middleware<P, Q, B> {
  return middleware
}

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean)
  methods?: string[]
  headers?: string[]
  credentials?: boolean
  maxAge?: number
}

/** Marks middleware that answers preflight, so the router registers OPTIONS for its routes. */
export const handlesPreflight = Symbol.for('kitr.api.handlesPreflight')

/** CORS with sensible defaults; handles preflight. */
export function cors(options: CorsOptions = {}): Middleware {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 600,
  } = options
  const allow = (reqOrigin: string | null): string | null => {
    if (origin === '*') return credentials && reqOrigin ? reqOrigin : '*'
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

export interface RateLimitOptions {
  /** Window length in ms. Default 60 000. */
  windowMs?: number
  /** Max requests per key per window. Default 100. */
  max?: number
  /** Key a request; default is the client IP. */
  key?: (ctx: HttpContext) => string
}

/** In-memory token bucket per key. Fine for one process; swap for Redis behind the same signature when you scale out. */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
  const { windowMs = 60_000, max = 100, key = (ctx) => ctx.request.ip() ?? 'unknown' } = options
  const buckets = new Map<string, { count: number; resetAt: number }>()
  return async (ctx, next) => {
    const now = Date.now()
    const k = key(ctx)
    let bucket = buckets.get(k)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(k, bucket)
      if (buckets.size > 10_000)
        for (const [bk, b] of buckets) if (b.resetAt <= now) buckets.delete(bk)
    }
    bucket.count++
    ctx.response.header('ratelimit-limit', String(max))
    ctx.response.header('ratelimit-remaining', String(Math.max(0, max - bucket.count)))
    ctx.response.header('ratelimit-reset', String(Math.ceil((bucket.resetAt - now) / 1000)))
    if (bucket.count > max) throw new KitrError('RATE_LIMITED', 'Too many requests')
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
