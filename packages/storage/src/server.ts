import type { CookieItem, CookieOptions, CookieSource } from './index'

/** The parts of an h3 v2 event (or anything request/response shaped) that cookies need. */
export interface CookieEventLike {
  /** The request; only its headers are read. */
  req: { headers: Headers }
  /** The response; `Set-Cookie` headers are appended here. */
  res: { headers: Headers }
}

/** Typed cookie access for one request, returned by `cookies()`. */
export interface ServerCookies {
  /** The item's value from the request's `Cookie` header, or its default. */
  get<T>(item: CookieItem<T>): T
  /** Appends a `Set-Cookie` header; `httpOnly` and the other item options apply. */
  set<T>(item: CookieItem<T>, value: T, options?: CookieOptions): void
  /** Appends a `Set-Cookie` header that expires the cookie. */
  remove(item: CookieItem<unknown>): void
  /** The raw `Cookie` header, for `<CookieHeader>` during SSR. */
  readonly header: string | null
}

/**
 * Typed cookies on the server: `cookies(event)` in a controller or middleware,
 * `cookies(request, responseHeaders)` anywhere you only have the Fetch primitives.
 */
export function cookies(event: CookieEventLike): ServerCookies
export function cookies(request: Request, responseHeaders: Headers): ServerCookies
export function cookies(
  source: CookieEventLike | Request,
  responseHeaders?: Headers,
): ServerCookies {
  const reqHeaders = 'req' in source ? source.req.headers : source.headers
  const resHeaders = 'res' in source ? source.res.headers : (responseHeaders as Headers)
  const header = reqHeaders.get('cookie')
  const headerSource: CookieSource = header
  return {
    header,
    get: (item) => item.get(headerSource),
    set: (item, value, options) => resHeaders.append('set-cookie', item.serialize(value, options)),
    remove: (item) => resHeaders.append('set-cookie', item.serialize(null)),
  }
}
