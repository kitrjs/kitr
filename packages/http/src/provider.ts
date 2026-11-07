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

/** Types `config/http.ts`: `export default defineConfig({ baseUrl: env.VITE_API_URL })`. */
export const defineConfig = createDefineConfig<HttpConfig>()

/** Binds `http` (the ky client) into the container from `config/http.ts`. */
export const httpProvider = defineProvider({
  name: 'http',
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
      // Development: every request shows up in the devtools Log panel under "http".
      const started = new WeakMap<Request, number>()
      return createHttpClient({
        ...config,
        hooks: {
          ...config.hooks,
          beforeRequest: [
            ({ request }) => void started.set(request, performance.now()),
            ...(config.hooks?.beforeRequest ?? []),
          ],
          afterResponse: [
            ({ request, response }) => {
              const ms = Math.round(performance.now() - (started.get(request) ?? performance.now()))
              hub.log(
                'http',
                `${request.method} ${new URL(request.url).pathname} → ${response.status} (${ms}ms)`,
                { url: request.url, status: response.status, ms },
                response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info',
              )
            },
            ...(config.hooks?.afterResponse ?? []),
          ],
        },
      })
    })
  },
})

export default httpProvider
