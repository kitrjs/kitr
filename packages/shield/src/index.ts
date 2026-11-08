import { createDefineConfig, inProduction, KitrError } from '@kitr/core'
import type { H3Event, Middleware } from 'h3'

/** Options for `cors()` and the `cors` key of `config/shield.ts`. */
export interface CorsOptions {
  /** `'*'`, a list of origins, or a predicate. Default: same-origin only (no header). */
  origin?: '*' | string[] | ((origin: string) => boolean)
  /** Methods a preflight allows. Default GET, POST, PUT, PATCH, DELETE, OPTIONS. */
  methods?: string[]
  /** Request headers a preflight allows. Default Content-Type, Authorization, X-CSRF-Token, X-Requested-With. */
  headers?: string[]
  /** Let the browser send cookies cross-origin. Refused together with `origin: '*'`. Default false. */
  credentials?: boolean
  /** Seconds a preflight answer may be cached. Default 600. */
  maxAge?: number
}

/** Options for `csrf()` and the `csrf` key of `config/shield.ts`. */
export interface CsrfOptions {
  /** Cookie that carries the token. Default `kitr-csrf`. */
  cookie?: string
  /** Header the client sends it back in. Default `x-csrf-token`. */
  header?: string
  /** Methods that need a token. Default POST, PUT, PATCH and DELETE. */
  methods?: string[]
  /** Paths that never need a token (webhooks). Prefix match. */
  ignore?: string[]
  /** Add `Secure` to the cookie. Default: `production`. */
  secure?: boolean
  /** Whether this is a production process. `shield(server)` fills it from the app's mode; standalone, `inProduction()` from `@kitr/core` decides. */
  production?: boolean
}

/** Options for `rateLimit()` and the `rateLimit` key of `config/shield.ts`. */
export interface RateLimitOptions {
  /** Window length in milliseconds. Default 60 000. */
  windowMs?: number
  /** Requests per key per window. Default 100. */
  max?: number
  /** Key a request. Default: the client IP. */
  key?: (event: H3Event) => string
  /**
   * Read the client IP from `X-Forwarded-For` (first entry). Only turn this on behind a proxy
   * you control that overwrites the header: otherwise any client can send a new value with every
   * request and is never limited. Default false: the address of the connection.
   */
  trustProxy?: boolean
  /** Where counters live. Default: this process, so each instance counts on its own; use `createRedisRateLimitStore` to share one limit. */
  store?: RateLimitStore
  /** Paths that are never limited. Prefix match. */
  ignore?: string[]
}

/** Where rate-limit counters live. Implement it over Redis to share limits between instances. */
export interface RateLimitStore {
  /** Increment and return the count and when the window resets (ms epoch). */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>
}

/** Options for `securityHeaders()` and the `headers` key of `config/shield.ts`. */
export interface HeadersOptions {
  /** `Content-Security-Policy`. A string, or false to leave it out. Default: a strict policy for an SPA/SSR app. */
  contentSecurityPolicy?: string | false
  /** `Strict-Transport-Security` max-age in seconds; false to leave it out. Default one year in production. */
  hsts?: number | false
  /** `X-Frame-Options`. Default `DENY`; false to leave it out. */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false
  /** `Referrer-Policy`. Default `strict-origin-when-cross-origin`; false to leave it out. */
  referrerPolicy?: string | false
  /** `Permissions-Policy`. Default `camera=(), microphone=(), geolocation=()`; false to leave it out. */
  permissionsPolicy?: string | false
  /** Whether this is a production process, which turns HSTS on. `shield(server)` fills it from the app's mode; standalone, `inProduction()` from `@kitr/core` decides. */
  production?: boolean
}

/** The options in `config/shield.ts`. Each key takes its middleware's options, or false to turn it off. */
export interface ShieldConfig {
  /** Security headers. On unless false. */
  headers?: HeadersOptions | false
  /** CORS. Off unless set to an object. */
  cors?: CorsOptions | false
  /** Double-submit cookie CSRF. On unless false. */
  csrf?: CsrfOptions | false
  /** Fixed-window rate limit. On unless false. */
  rateLimit?: RateLimitOptions | false
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    shield: ShieldConfig
  }
}

/** Type the default export of `config/shield.ts`. Returns its argument unchanged. */
export const defineConfig = createDefineConfig<ShieldConfig>()

/** The Content-Security-Policy `securityHeaders()` sends when you don't set one: same-origin everything, inline scripts and styles allowed, no framing. */
export const DEFAULT_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

const prefixed = (path: string, list: string[] | undefined) =>
  !!list?.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`))

/** Middleware that sets nosniff, frame, referrer, permissions, CSP and (in production) HSTS headers on every response, errors included. */
export function securityHeaders(options: HeadersOptions = {}): Middleware {
  const production = options.production ?? inProduction()
  const {
    contentSecurityPolicy = DEFAULT_CSP,
    hsts = production ? 60 * 60 * 24 * 365 : false,
    frameOptions = 'DENY',
    referrerPolicy = 'strict-origin-when-cross-origin',
    permissionsPolicy = 'camera=(), microphone=(), geolocation=()',
  } = options
  return async (event, next) => {
    const h = event.res.headers
    h.set('x-content-type-options', 'nosniff')
    if (frameOptions) h.set('x-frame-options', frameOptions)
    if (referrerPolicy) h.set('referrer-policy', referrerPolicy)
    if (permissionsPolicy) h.set('permissions-policy', permissionsPolicy)
    if (contentSecurityPolicy) h.set('content-security-policy', contentSecurityPolicy)
    if (hsts) h.set('strict-transport-security', `max-age=${hsts}; includeSubDomains`)
    return next()
  }
}

/** Middleware that answers CORS preflights with 204 and adds `Access-Control-Allow-*` headers for allowed origins. Throws at once for `origin: '*'` with credentials. */
export function cors(options: CorsOptions = {}): Middleware {
  const {
    origin,
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    credentials = false,
    maxAge = 600,
  } = options
  // Reflecting any origin with credentials lets every site make authenticated requests as the user.
  if (origin === '*' && credentials)
    throw new Error(
      '[kitr/shield] cors({ origin: "*", credentials: true }) would let any site send requests with your users\' cookies; list the origins instead.',
    )
  const allow = (from: string | null): string | null => {
    if (!origin) return null
    if (origin === '*') return '*'
    if (!from) return null
    if (typeof origin === 'function') return origin(from) ? from : null
    return origin.includes(from) ? from : null
  }
  return async (event, next) => {
    const allowed = allow(event.req.headers.get('origin'))
    const h = event.res.headers
    if (allowed) {
      h.set('access-control-allow-origin', allowed)
      if (allowed !== '*') h.append('vary', 'Origin')
      if (credentials) h.set('access-control-allow-credentials', 'true')
    }
    if (event.req.method === 'OPTIONS') {
      h.set('access-control-allow-methods', methods.join(', '))
      h.set('access-control-allow-headers', headers.join(', '))
      h.set('access-control-max-age', String(maxAge))
      return new Response(null, { status: 204, headers: h })
    }
    return next()
  }
}

const randomToken = () => {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function readCookie(event: H3Event, name: string): string | undefined {
  const raw = event.req.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

/**
 * Double-submit cookie CSRF: a readable cookie carries a token the browser must echo in a header
 * (`fetch` from another origin cannot read the cookie, so it cannot forge the header). kitr/http
 * sends the header automatically.
 */
export function csrf(options: CsrfOptions = {}): Middleware {
  const {
    cookie = 'kitr-csrf',
    header = 'x-csrf-token',
    methods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    ignore,
    secure = options.production ?? inProduction(),
  } = options
  return async (event, next) => {
    let token = readCookie(event, cookie)
    if (!token) {
      token = randomToken()
      event.res.headers.append(
        'set-cookie',
        `${cookie}=${token}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`,
      )
    }
    const path = new URL(event.req.url).pathname
    if (methods.includes(event.req.method) && !prefixed(path, ignore)) {
      const sent = event.req.headers.get(header)
      if (!sent || sent !== readCookie(event, cookie))
        throw new KitrError('FORBIDDEN', 'CSRF token missing or invalid')
    }
    return next()
  }
}

/** The default rate-limit store: counters in this process, pruned past 10,000 keys. Each instance counts on its own. */
export function createMemoryRateLimitStore(): RateLimitStore {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return {
    async hit(key, windowMs) {
      const now = Date.now()
      const entry = hits.get(key)
      if (!entry || entry.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs }
        hits.set(key, fresh)
        if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
        return fresh
      }
      entry.count++
      return entry
    },
  }
}

/**
 * The part of an [ioredis](https://github.com/redis/ioredis) client the Redis rate-limit store
 * uses. An ioredis `Redis` or `Cluster` fits as it is.
 */
export interface RedisRateLimitClient {
  /** `SET key value PX ms NX`: starts a window only when none is open. */
  set(key: string, value: string, px: 'PX', ms: number, nx: 'NX'): Promise<unknown>
  /** `INCR`: keeps the key's expiry. */
  incr(key: string): Promise<number>
  /** `PTTL`: milliseconds left on the window. */
  pttl(key: string): Promise<number>
  /** `PEXPIRE`: repairs a counter that lost its window. */
  pexpire(key: string, ms: number): Promise<number>
}

/**
 * A rate-limit store over Redis, so every instance counts against the same limit. Each window
 * is one key that Redis expires itself, so nothing needs sweeping:
 *
 *   rateLimit: { store: createRedisRateLimitStore(new Redis(process.env.REDIS_URL)) }
 *
 * Keys live under `prefix` (default `kitr:rl:`).
 */
export function createRedisRateLimitStore(
  redis: RedisRateLimitClient,
  options: { prefix?: string } = {},
): RateLimitStore {
  const prefix = options.prefix ?? 'kitr:rl:'
  return {
    async hit(key, windowMs) {
      const k = prefix + key
      // Open the window with its expiry first, so a crash between commands never leaves a
      // counter without one; INCR then keeps that expiry.
      await redis.set(k, '0', 'PX', windowMs, 'NX')
      const count = await redis.incr(k)
      let ttl = await redis.pttl(k)
      // The window expired between SET and INCR, so INCR made a key with no expiry: give it one.
      if (ttl < 0) {
        await redis.pexpire(k, windowMs)
        ttl = windowMs
      }
      return { count, resetAt: Date.now() + ttl }
    },
  }
}

function clientIp(event: H3Event, trustProxy: boolean): string | undefined {
  if (trustProxy) {
    const forwarded = event.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
  }
  // srvx puts the connection's address on the request.
  return (event.req as { ip?: string }).ip || undefined
}

/** Fixed-window rate limit with `RateLimit-*` headers and a 429 when exceeded. */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
  const {
    windowMs = 60_000,
    max = 100,
    trustProxy = false,
    key = (event) => clientIp(event, trustProxy) ?? 'anonymous',
    store = createMemoryRateLimitStore(),
    ignore,
  } = options
  return async (event, next) => {
    const path = new URL(event.req.url).pathname
    if (prefixed(path, ignore)) return next()
    const { count, resetAt } = await store.hit(key(event), windowMs)
    const h = event.res.headers
    h.set('ratelimit-limit', String(max))
    h.set('ratelimit-remaining', String(Math.max(0, max - count)))
    h.set('ratelimit-reset', String(Math.ceil((resetAt - Date.now()) / 1000)))
    if (count > max) {
      h.set('retry-after', String(Math.ceil((resetAt - Date.now()) / 1000)))
      throw new KitrError('RATE_LIMITED', 'Too many requests')
    }
    return next()
  }
}

/** The middlewares `config/shield.ts` asks for, in the right order. */
export function shieldMiddlewares(config: ShieldConfig = {}): Middleware[] {
  const list: Middleware[] = []
  if (config.headers !== false) list.push(securityHeaders(config.headers ?? {}))
  if (config.cors) list.push(cors(config.cors))
  if (config.rateLimit !== false) list.push(rateLimit(config.rateLimit ?? {}))
  if (config.csrf !== false) list.push(csrf(config.csrf ?? {}))
  return list
}

/**
 * Attach the shield to a kitr server (or any object with `use(middleware)`), reading
 * `config/shield.ts`. Production (HSTS, Secure cookies) follows the app's mode, so a Workers or
 * Deno deployment that never sets `NODE_ENV` still gets production defaults from the build.
 */
export function shield<
  S extends {
    use(middleware: Middleware): unknown
    app?: { config: any; isProduction: boolean }
  },
>(server: S, config?: ShieldConfig): S {
  const resolved: ShieldConfig = {
    ...(config ?? server.app?.config.get('shield', {} as ShieldConfig) ?? {}),
  }
  const production = inProduction(server.app)
  if (resolved.headers !== false) resolved.headers = { production, ...(resolved.headers ?? {}) }
  if (resolved.csrf !== false) resolved.csrf = { production, ...(resolved.csrf ?? {}) }
  for (const m of shieldMiddlewares(resolved)) server.use(m)
  return server
}
