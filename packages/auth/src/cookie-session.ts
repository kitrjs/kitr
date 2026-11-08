import { inProduction } from '@kitr/core'
import { fromBase64Url, timingSafeEqual, toBase64Url } from './password'
import type { SessionRecord, SessionStore } from './store'

/** Options for `createCookieSession`. */
export interface CookieSessionOptions {
  /**
   * The key the cookie is signed with, at least 32 characters (`openssl rand -base64 32`). A list
   * rotates keys: the first signs new cookies, every entry still verifies old ones.
   */
  secret: string | string[]
  /** Where session records live: `createMemorySessionStore()`, a storage driver or Redis. */
  store: SessionStore
  /** How the cookie is set. Defaults are HttpOnly, `SameSite=Lax`, `Path=/` and `Secure` in production. */
  cookie?: {
    /** Cookie name. Default `kitr-session`. */
    name?: string
    /** Domain, to share the session with subdomains. Default none (this host only). */
    domain?: string
    /** Path. Default `/`. */
    path?: string
    /** `lax` (default) or `strict`. `none` is not offered: a session cookie should not travel cross-site. */
    sameSite?: 'lax' | 'strict'
    /** Add `Secure`. Default: true in production. */
    secure?: boolean
    /** Whether this is a production process. Standalone, `inProduction()` from `@kitr/core` decides. */
    production?: boolean
  }
  /** Idle lifetime in seconds: a session unused for this long expires, each use slides it forward. Default 7 days. */
  maxAge?: number
  /** Absolute lifetime in seconds from sign-in, however active the session is. Default 30 days. */
  absoluteMaxAge?: number
}

/** Anything that carries a request's cookies: a `Request` or its `Headers`. */
export type RequestLike = Request | Headers

/** Extra data for a new session. */
export interface CreateSessionOptions {
  /** The request that signs in. Its current session, if any, is destroyed first, so an id planted before sign-in never survives it. */
  request?: RequestLike
  /** Stored on the record (`record.data`). */
  data?: Record<string, unknown>
}

/** The cookie session service `createCookieSession` returns. All writes append `Set-Cookie` to headers you pass in. */
export interface CookieSessions {
  /** The cookie's name. */
  readonly cookieName: string
  /** Idle lifetime in seconds. */
  readonly maxAge: number
  /**
   * The live session of a request, or `null`: no cookie, a bad signature, an unknown id or an
   * expired record. When more than a quarter of the idle time has passed since the last use, it
   * extends the record and, if you pass `response`, sends a fresh cookie (sliding expiry).
   */
  resolve(request: RequestLike, response?: Headers): Promise<SessionRecord | null>
  /** Start a session for a user: a new random id, a signed `Set-Cookie` on `response`. Replaces the request's current session. */
  create(userId: string, response: Headers, options?: CreateSessionOptions): Promise<SessionRecord>
  /** Replace the request's session id with a new one (same user, same absolute lifetime). Call after a privilege change. */
  rotate(request: RequestLike, response: Headers): Promise<SessionRecord | null>
  /** End the request's session and expire the cookie. */
  destroy(request: RequestLike, response: Headers): Promise<void>
  /** Revoke one session by id, from any request ("sign out this device"). */
  revoke(id: string): Promise<void>
  /** Revoke every session of a user ("sign out everywhere"). Resolves how many were live. */
  revokeAll(userId: string): Promise<number>
  /** The live sessions of a user. */
  list(userId: string): Promise<SessionRecord[]>
  /** Sign a string with the current secret (`value.signature`). The email-link tokens use it. */
  sign(value: string): Promise<string>
  /** The value of a signed string when any configured secret signed it, else `null`. */
  unsign(signed: string): Promise<string | null>
}

const encoder = new TextEncoder()
const keyCache = new Map<string, Promise<CryptoKey>>()

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret)
  if (!key) {
    key = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
    keyCache.set(secret, key)
  }
  return key
}

/** `value.signature`, signed with HMAC-SHA256 through Web Crypto: runs on Node, Bun, Deno and Workers. */
export async function signValue(value: string, secret: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(value))
  return `${value}.${toBase64Url(new Uint8Array(sig))}`
}

/** The value of a `signValue` string when any of the secrets signed it, else `null`. Verifies in constant time. */
export async function unsignValue(signed: string, secrets: string[]): Promise<string | null> {
  const dot = signed.lastIndexOf('.')
  if (dot < 1) return null
  const value = signed.slice(0, dot)
  let signature: Uint8Array
  try {
    signature = fromBase64Url(signed.slice(dot + 1))
  } catch {
    return null
  }
  let ok = false
  // Try every key without stopping early, so rotation does not leak which one matched.
  for (const secret of secrets) {
    const matched = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      signature as BufferSource,
      encoder.encode(value),
    )
    ok ||= matched
  }
  return ok ? value : null
}

/** A cookie's value from a request, or `undefined`. */
export function readCookie(request: RequestLike, name: string): string | undefined {
  const header = (request instanceof Headers ? request : request.headers).get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return undefined
}

const randomId = () => toBase64Url(crypto.getRandomValues(new Uint8Array(32)))

/**
 * Cookie sessions: an HttpOnly, signed cookie carrying a random session id, with the session
 * itself in a `SessionStore`. Nothing about the user is in the cookie, so revoking a session
 * (sign out, "sign out everywhere", a password reset) takes effect on the next request.
 *
 *   const sessions = createCookieSession({ secret: env.SESSION_SECRET, store: createMemorySessionStore() })
 *   const record = await sessions.create(user.id, response.headers)   // sign in
 *   const current = await sessions.resolve(request, response.headers) // every later request
 *
 * The id is replaced on every sign-in (`create`), the idle expiry slides on use and the absolute
 * one does not, and signing uses Web Crypto so the same code runs on Node, Bun, Deno and Workers.
 */
export function createCookieSession(options: CookieSessionOptions): CookieSessions {
  const secrets = Array.isArray(options.secret) ? options.secret : [options.secret]
  if (!secrets.length || secrets.some((s) => s.length < 32))
    throw new Error(
      '[kitr/auth] The session secret must be at least 32 characters. Generate one with `openssl rand -base64 32`.',
    )
  const { store } = options
  const name = options.cookie?.name ?? 'kitr-session'
  const maxAge = options.maxAge ?? 60 * 60 * 24 * 7
  const absoluteMaxAge = options.absoluteMaxAge ?? 60 * 60 * 24 * 30
  const secure = options.cookie?.secure ?? options.cookie?.production ?? inProduction()

  const attributes = (seconds: number) => {
    const parts = [
      `Max-Age=${Math.max(0, Math.floor(seconds))}`,
      `Path=${options.cookie?.path ?? '/'}`,
    ]
    if (options.cookie?.domain) parts.push(`Domain=${options.cookie.domain}`)
    parts.push('HttpOnly')
    if (secure) parts.push('Secure')
    parts.push(`SameSite=${options.cookie?.sameSite === 'strict' ? 'Strict' : 'Lax'}`)
    return parts.join('; ')
  }
  const send = async (record: SessionRecord, response: Headers) =>
    response.append(
      'set-cookie',
      `${name}=${await signValue(record.id, secrets[0]!)}; ${attributes((record.expiresAt - Date.now()) / 1000)}`,
    )
  const expire = (response: Headers) =>
    response.append(
      'set-cookie',
      `${name}=; ${attributes(0)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    )
  const idOf = async (request: RequestLike) => {
    const raw = readCookie(request, name)
    return raw ? unsignValue(raw, secrets) : null
  }
  const persist = async (record: SessionRecord) => {
    await store.set(record, record.expiresAt - Date.now())
  }
  const nextExpiry = (createdAt: number) =>
    Math.min(Date.now() + maxAge * 1000, createdAt + absoluteMaxAge * 1000)

  const sessions: CookieSessions = {
    cookieName: name,
    maxAge,
    async resolve(request, response) {
      const id = await idOf(request)
      if (!id) return null
      const record = await store.get(id)
      if (!record || record.expiresAt <= Date.now()) return null
      // Slide only when a quarter of the idle time is gone: a store write per request is wasteful.
      const remaining = record.expiresAt - Date.now()
      const next = nextExpiry(record.createdAt)
      if (remaining < maxAge * 1000 * 0.75 && next > record.expiresAt) {
        record.expiresAt = next
        await persist(record)
        if (response) await send(record, response)
      }
      return record
    },
    async create(userId, response, createOptions = {}) {
      // Never keep an id that existed before sign-in (session fixation).
      if (createOptions.request) {
        const old = await idOf(createOptions.request)
        if (old) await store.delete(old)
      }
      const now = Date.now()
      const record: SessionRecord = {
        id: randomId(),
        userId,
        createdAt: now,
        expiresAt: nextExpiry(now),
        ...(createOptions.data ? { data: createOptions.data } : {}),
      }
      await persist(record)
      await send(record, response)
      return record
    },
    async rotate(request, response) {
      const id = await idOf(request)
      const old = id ? await store.get(id) : null
      if (!id || !old || old.expiresAt <= Date.now()) return null
      const record: SessionRecord = { ...old, id: randomId() }
      await persist(record)
      await store.delete(id)
      await send(record, response)
      return record
    },
    async destroy(request, response) {
      const id = await idOf(request)
      if (id) await store.delete(id)
      expire(response)
    },
    sign: (value) => signValue(value, secrets[0]!),
    unsign: (signed) => unsignValue(signed, secrets),
    revoke: (id) => store.delete(id),
    revokeAll: (userId) => store.deleteForUser(userId),
    list: (userId) => store.listForUser(userId),
  }
  return sessions
}

/** Compare two strings in constant time (CSRF tokens, signatures). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(encoder.encode(a), encoder.encode(b))
}
