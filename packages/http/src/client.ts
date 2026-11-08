import { isKitrErrorShape, KitrError, toKitrError } from '@kitr/core'
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
          const token = await getToken?.()
          if (token) {
            request.headers.set(
              authHeader,
              authHeader === 'Authorization' ? `Bearer ${token}` : token,
            )
          }
          // @kitr/shield's double-submit cookie: echo it on every write so same-origin calls pass.
          if (
            !/^(GET|HEAD|OPTIONS)$/i.test(request.method) &&
            !request.headers.has('x-csrf-token')
          ) {
            const csrf = readCsrfCookie()
            if (csrf) request.headers.set('x-csrf-token', csrf)
          }
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
          if (token)
            retried.headers.set(
              authHeader,
              authHeader === 'Authorization' ? `Bearer ${token}` : token,
            )
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
    if (isKitrErrorShape(body)) {
      return new KitrError(body.code, body.message, {
        status: body.status || response.status,
        fieldErrors: body.fieldErrors,
        data: body.data,
        cause: error,
      })
    }
    const b = body as any
    // Common shapes: { message }, { error: { message } }, { errors: [{ field, message }] } (Adonis/VineJS)
    const message: string | undefined = b?.message ?? b?.error?.message ?? b?.error
    const fieldErrors = Array.isArray(b?.errors)
      ? b.errors.reduce((acc: Record<string, string[]>, e: any) => {
          const field = e.field ?? e.path ?? '_root'
          acc[field] ??= []
          acc[field].push(e.message ?? String(e))
          return acc
        }, {})
      : undefined
    const kitrError = KitrError.fromStatus(
      response.status,
      typeof message === 'string' ? message : undefined,
      body,
    )
    return fieldErrors
      ? new KitrError(kitrError.code, kitrError.message, {
          status: response.status,
          fieldErrors,
          data: body,
          cause: error,
        })
      : kitrError
  }
  return toKitrError(error)
}

function readCsrfCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|;\s*)kitr-csrf=([^;]+)/)
  return m ? decodeURIComponent(m[1]!) : undefined
}
