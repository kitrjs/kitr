import { createDefineConfig, KitrError } from '@kitr/core'
import type { H3Event, Middleware } from 'h3'

export interface CorsOptions {
  /** `'*'`, a list of origins, or a predicate. Default: same-origin only (no header). */
  origin?: '*' | string[] | ((origin: string) => boolean)
  methods?: string[]
  headers?: string[]
  credentials?: boolean
  /** Seconds a preflight answer may be cached. Default 600. */
  maxAge?: number
}

export interface CsrfOptions {
  /** Cookie that carries the token. Default `kitr-csrf`. */
  cookie?: string
  /** Header the client sends it back in. Default `x-csrf-token`. */
  header?: string
  /** Methods that need a token. Default: everything but GET, HEAD, OPTIONS. */
  methods?: string[]
  /** Paths that never need a token (webhooks). Prefix match. */
  ignore?: string[]
  secure?: boolean
}

export interface RateLimitOptions {
  /** Window length in milliseconds. Default 60 000. */
  windowMs?: number
  /** Requests per key per window. Default 100. */
  max?: number
  /** Key a request. Default: the client IP. */
  key?: (event: H3Event) => string
  /** Where counters live. Default: this process. */
  store?: RateLimitStore
  /** Paths that are never limited. Prefix match. */
  ignore?: string[]
}

export interface RateLimitStore {
  /** Increment and return the count and when the window resets (ms epoch). */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>
}

export interface HeadersOptions {
  /** `Content-Security-Policy`. A string, or false to leave it out. Default: a strict policy for an SPA/SSR app. */
  contentSecurityPolicy?: string | false
  /** `Strict-Transport-Security` max-age in seconds; false to leave it out. Default one year in production. */
  hsts?: number | false
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false
  referrerPolicy?: string | false
  /** `Permissions-Policy`. Default disables camera, microphone and geolocation unless `native` asks for them. */
  permissionsPolicy?: string | false
}

export interface ShieldConfig {
  /** false turns the headers off. */
  headers?: HeadersOptions | false
  cors?: CorsOptions | false
  csrf?: CsrfOptions | false
  rateLimit?: RateLimitOptions | false
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    shield: ShieldConfig
  }
}

export const defineConfig = createDefineConfig<ShieldConfig>()

export const DEFAULT_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

const prefixed = (path: string, list: string[] | undefined) =>
  !!list?.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`))

/** Security headers on every response. */
export function securityHeaders(options: HeadersOptions = {}): Middleware {
  const production = (globalThis as any).process?.env?.NODE_ENV === 'production'
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

/** CORS with preflight answers. */
export function cors(options: CorsOptions = {}): Middleware {
  const {
    origin,
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    credentials = false,
    maxAge = 600,
  } = options
  const allow = (from: string | null): string | null => {
    if (!origin) return null
    if (origin === '*') return credentials && from ? from : '*'
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
    secure = (globalThis as any).process?.env?.NODE_ENV === 'production',
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

/** Fixed-window rate limit with `RateLimit-*` headers and a 429 when exceeded. */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
  const {
    windowMs = 60_000,
    max = 100,
    key = (event) =>
      event.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      (event as any).context?.clientAddress ||
      'anonymous',
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

/** Attach the shield to a kitr server (or any object with `use(middleware)`), reading `config/shield.ts`. */
export function shield<S extends { use(middleware: Middleware): unknown; app?: { config: any } }>(
  server: S,
  config?: ShieldConfig,
): S {
  const resolved = config ?? server.app?.config.get('shield', {} as ShieldConfig) ?? {}
  for (const m of shieldMiddlewares(resolved)) server.use(m)
  return server
}
