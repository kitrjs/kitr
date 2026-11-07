import { createDefineConfig } from '@kitr/core'

export interface ApiConfig {
  /** Prefix for all routes, e.g. `/api`. Default none. */
  prefix?: string
  /** Where `kitr api:sync` writes the OpenAPI document. Default `openapi.json`. */
  openapi?: { path?: string; title?: string; version?: string; description?: string }
  /** Where `kitr api:sync` writes the typed client. Default `app/api/client.ts`. */
  client?: { path?: string }
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    api: ApiConfig
  }
}

export const defineConfig = createDefineConfig<ApiConfig>()
