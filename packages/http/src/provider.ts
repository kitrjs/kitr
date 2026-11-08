import { type Container, createDefineConfig, defineProvider, getDevtools } from '@kitr/core'
import type { KyInstance } from 'ky'
import { createHttpClient, type HttpClientOptions } from './client'

/**
 * The shape of `config/http.ts`: the options `createHttpClient` takes, except that `getToken` and
 * `refresh` receive the container of the request (or the app, in the browser), so a token read
 * from a service belongs to the user being served: `getToken: (c) => c.use('auth').getToken()`.
 */
export interface HttpConfig extends Omit<HttpClientOptions, 'getToken' | 'refresh'> {
  getToken?: (container: Container) => ReturnType<NonNullable<HttpClientOptions['getToken']>>
  refresh?: (container: Container) => Promise<boolean>
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    http: HttpConfig
  }
  interface ContainerBindings {
    http: KyInstance
  }
}

const PREVIEW_LIMIT = 64 * 1024

/** Headers as an object with credentials hidden, so the Network panel never shows a token. */
function redact(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    const name = key.toLowerCase()
    out[name] = name === 'authorization' || name === 'cookie' ? '•••' : value
  })
  return out
}

/**
 * Up to 64KB of the response text, read from a clone so the caller's body stays untouched. Only
 * JSON and text types are read; streams such as server-sent events are skipped on purpose.
 */
async function previewBody(response: Response, contentType: string): Promise<string | undefined> {
  if (!/json|^text\//i.test(contentType) || /event-stream/i.test(contentType)) return undefined
  try {
    const reader = response.clone().body?.getReader()
    if (!reader) return undefined
    const decoder = new TextDecoder()
    let text = ''
    let bytes = 0
    while (bytes < PREVIEW_LIMIT) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      text += decoder.decode(value, { stream: true })
    }
    void reader.cancel().catch(() => {})
    return text.slice(0, PREVIEW_LIMIT)
  } catch {
    return undefined
  }
}

/** Types `config/http.ts`: `export default defineConfig({ baseUrl: env.VITE_API_URL })`. */
export const defineConfig = createDefineConfig<HttpConfig>()

/** Binds `http` (the ky client) into the container from `config/http.ts`. */
export const httpProvider = defineProvider({
  name: 'http',
  devtools: () => import('./devtools').then((m) => m.panels()),
  register(app) {
    // Scoped: on the server every request builds its own client, so one user's token never
    // reaches another's request. In the browser there is one container, so one client.
    app.container.scoped('http', (container) => {
      const { getToken, refresh, ...rest } = app.config.get('http', {})
      const config: HttpClientOptions = {
        ...rest,
        getToken: getToken && (() => getToken(container)),
        refresh: refresh && (() => refresh(container)),
      }
      const hub = getDevtools(app)
      if (!hub) return createHttpClient(config)
      // Development: every request shows up in the devtools Network panel and the Log under "http".
      // Keyed on the options object: ky hands every hook of one call the same options, while the
      // Request it passes to afterResponse can be a fresh clone of the one beforeRequest saw.
      const started = new WeakMap<object, number>()
      // Requests already logged from a response, so `beforeError` only adds failures with none.
      const logged = new WeakSet<Request>()
      let seq = 0
      const nextId = () => `${Date.now().toString(36)}-${++seq}`
      return createHttpClient({
        ...config,
        hooks: {
          ...config.hooks,
          beforeRequest: [
            ({ options }) => void started.set(options, performance.now()),
            ...(config.hooks?.beforeRequest ?? []),
          ],
          afterResponse: [
            async ({ request, options, response }) => {
              logged.add(request)
              const ms = Math.round(performance.now() - (started.get(options) ?? performance.now()))
              const url = new URL(request.url)
              const contentType = response.headers.get('content-type') ?? ''
              const length = response.headers.get('content-length')
              const data: Record<string, unknown> = {
                id: nextId(),
                method: request.method,
                url: request.url,
                path: url.pathname + url.search,
                status: response.status,
                ok: response.ok,
                ms,
                requestHeaders: redact(request.headers),
                responseHeaders: Object.fromEntries(response.headers),
                contentType,
                size: length === null || Number.isNaN(Number(length)) ? undefined : Number(length),
              }
              const body = await previewBody(response, contentType)
              if (body !== undefined) data.body = body
              hub.log(
                'http',
                `${request.method} ${url.pathname} → ${response.status} (${ms}ms)`,
                data,
                response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info',
              )
            },
            ...(config.hooks?.afterResponse ?? []),
          ],
          beforeError: [
            ...(config.hooks?.beforeError ?? []),
            ({ request, error }) => {
              // Failures that carry a response were logged above; this catches the ones that did
              // not get one (network down, timeout).
              if (!logged.has(request)) {
                hub.log(
                  'http',
                  `${request.method} ${new URL(request.url).pathname} failed`,
                  { method: request.method, url: request.url, message: error.message },
                  'error',
                )
              }
              return error
            },
          ],
        },
      })
    })
  },
})

export default httpProvider
