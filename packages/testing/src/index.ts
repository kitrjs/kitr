import { type CreateAppOptions, createApp, type KitrApp } from '@kitr/core'

/**
 * Creates and boots an app for one test, with `environment: 'test'` and the providers and config
 * you pass. Use it to read services from the container or to render components with `renderWithKitr`.
 */
export async function createTestApp(options: CreateAppOptions = {}): Promise<KitrApp> {
  const app = createApp({ environment: 'test', ...options })
  await app.boot()
  return app
}

/** What every `createTestClient` call resolves to: the status, headers and parsed body of one response. */
export interface TestResponse<T = unknown> {
  /** The HTTP status code, such as `201` or `422`. */
  status: number
  /** The response headers. */
  headers: Headers
  /** The body parsed as JSON; the raw text when it is not JSON; `undefined` when it is empty. */
  body: T
  /** The raw `Response`. Its body has already been read. */
  response: Response
}

/**
 * Request helper for API tests against anything with `fetch(request)`: a kitr server, a Start
 * handler, or a real URL. It sends JSON, parses JSON back and adds `defaults.headers` to every call,
 * without opening a port when given a handler.
 */
export function createTestClient(
  target: { fetch(request: Request): Promise<Response> } | string,
  defaults: { headers?: Record<string, string> } = {},
) {
  const base = typeof target === 'string' ? target.replace(/\/$/, '') : 'http://test'
  const doFetch =
    typeof target === 'string' ? (r: Request) => fetch(r) : (r: Request) => target.fetch(r)
  const call = async <T>(
    method: string,
    path: string,
    body?: unknown,
    init: { headers?: Record<string, string> } = {},
  ): Promise<TestResponse<T>> => {
    const headers = new Headers({
      accept: 'application/json',
      ...defaults.headers,
      ...init.headers,
    })
    if (body !== undefined) headers.set('content-type', 'application/json')
    const response = await doFetch(
      new Request(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    const text = await response.text()
    let parsed: unknown = text
    try {
      parsed = text ? JSON.parse(text) : undefined
    } catch {}
    return { status: response.status, headers: response.headers, body: parsed as T, response }
  }
  return {
    get: <T = unknown>(path: string, init?: { headers?: Record<string, string> }) =>
      call<T>('GET', path, undefined, init),
    post: <T = unknown>(
      path: string,
      body?: unknown,
      init?: { headers?: Record<string, string> },
    ) => call<T>('POST', path, body, init),
    put: <T = unknown>(path: string, body?: unknown, init?: { headers?: Record<string, string> }) =>
      call<T>('PUT', path, body, init),
    patch: <T = unknown>(
      path: string,
      body?: unknown,
      init?: { headers?: Record<string, string> },
    ) => call<T>('PATCH', path, body, init),
    delete: <T = unknown>(path: string, init?: { headers?: Record<string, string> }) =>
      call<T>('DELETE', path, undefined, init),
  }
}

/** Re-exported from `@kitr/kitr/app`: creates an app without booting it, for tests that boot it themselves. */
export { createApp }
