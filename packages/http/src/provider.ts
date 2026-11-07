import { createDefineConfig, defineProvider } from '@kitr/core'
import type { KyInstance } from 'ky'
import { createHttpClient, type HttpClientOptions } from './client'

export type HttpConfig = HttpClientOptions

declare module '@kitr/core' {
  interface ConfigRegistry {
    http: HttpConfig
  }
  interface ContainerBindings {
    http: KyInstance
  }
}

export const defineConfig = createDefineConfig<HttpConfig>()

/** Binds `http` (the ky client) into the container from `config/http.ts`. */
export const httpProvider = defineProvider({
  name: 'http',
  register(app) {
    app.container.singleton('http', () => createHttpClient(app.config.get('http', {})))
  },
})

export default httpProvider
