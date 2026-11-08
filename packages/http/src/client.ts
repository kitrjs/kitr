import { type KitrError, toKitrError } from '@kitr/core'
import { applyRequestHeaders, bearerValue, fromEnvelope } from '@kitr/core/request'
import ky, { HTTPError, type KyInstance, type Options } from 'ky'

/** Options for `createHttpClient` and `config/http.ts`: kitr's auth settings plus every ky option except `prefixUrl`. */
export interface HttpClientOptions extends Omit<Options, 'prefixUrl'> {
  /** Base URL; usually from validated env. */
  baseUrl?: string
  /** Called before every request. Return a bearer token or nothing. */
  getToken?: () => Promise<string | null | undefined> | string | null | undefined
  /** Called once on 401. Return true if a fresh token is available and the request should retry. */
  refresh?: () => Promise<boolean>
  /** Called when a 401 cannot be recovered (e.g. redirect to sign-in). */
  onUnauthorized?: (error: KitrError) => void
  /** Header name for the token (default `Authorization` with `Bearer `). */
  authHeader?: string
}

/**
 * A `ky` instance with kitr's auth, refresh and error conventions.
 * Every failure becomes a `KitrError`, so forms and queries see one shape.
 */
export function createHttpClient(options: HttpClientOptions = {}): KyInstance {
  const {
    baseUrl,
    getToken,
    refresh,
    onUnauthorized,
    authHeader = 'Authorization',
    ...rest
  } = options
  let refreshing: Promise<boolean> | null = null

  // ky v2 renamed `prefixUrl` to `prefix` (same joining rules: `http.get('users')` → `${baseUrl}/users`).
  const client: KyInstance = ky.create({
    ...(baseUrl ? { prefix: baseUrl } : {}),
    retry: { limit: 2, methods: ['get', 'put', 'head', 'delete', 'options', 'trace'] },
    ...rest,
    hooks: {
      ...rest.hooks,
      beforeRequest: [
        async ({ request }) => {
          // Bearer token, and @kitr/shield's double-submit CSRF cookie echoed on writes.
          applyRequestHeaders(request.headers, {
            method: request.method,
            token: await getToken?.(),
            authHeader,
          })
        },
        ...(rest.hooks?.beforeRequest ?? []),
      ],
      afterResponse: [
        async ({ request, response }) => {
          if (response.status !== 401 || !refresh) return response
          if (request.headers.get('x-kitr-retried')) return response
          refreshing ??= refresh().finally(() => {
            refreshing = null
          })
          const ok = await refreshing
          if (!ok) return response
          const retried = new Request(request, { headers: new Headers(request.headers) })
          retried.headers.set('x-kitr-retried', '1')
          const token = await getToken?.()
          if (token) retried.headers.set(authHeader, bearerValue(token, authHeader))
          // Retry through this same client so custom fetch, hooks and error normalisation still apply.
          return client(retried)
        },
        ...(rest.hooks?.afterResponse ?? []),
      ],
      beforeError: [
        async ({ error }) => {
          const normalised = await normaliseHttpError(error)
          if (normalised.status === 401) onUnauthorized?.(normalised)
          return normalised as unknown as HTTPError
        },
        ...(rest.hooks?.beforeError ?? []),
      ],
    },
  })
  return client
}

/** Turns a ky HTTPError into a KitrError, reading kitr's wire shape when the body has it. */
export async function normaliseHttpError(error: unknown): Promise<KitrError> {
  if (error instanceof HTTPError) {
    const { response } = error
    // ky v2 has already read the body into `error.data`; v1 left it on the response.
    let body: unknown = (error as HTTPError & { data?: unknown }).data
    if (body === undefined) {
      try {
        body = await response.clone().json()
      } catch {}
    }
    return fromEnvelope(body, response.status, { cause: error })
  }
  return toKitrError(error)
}
