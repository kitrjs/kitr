import { type CreateAppOptions, createApp, type KitrApp } from '@kitr/core'

/** A booted app for tests: `environment: 'test'`, your providers and config. */
export async function createTestApp(options: CreateAppOptions = {}): Promise<KitrApp> {
  const app = createApp({ environment: 'test', ...options })
  await app.boot()
  return app
}

export interface TestResponse<T = unknown> {
  status: number
  headers: Headers
  body: T
  response: Response
}

/**
 * Request helper for API tests against anything with `fetch(request)`:
 * a kitr server, a Start handler, or a real URL.
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

export { createApp }
