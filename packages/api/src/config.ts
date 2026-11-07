import { createDefineConfig } from '@kitr/core'

/** Options in `config/api.ts`, read by `kitr api:sync`. */
export interface ApiConfig {
  /** Documents the prefix routes share, e.g. `/api`. The router does not read it; set it with `router.group({ prefix })`. */
  prefix?: string
  /** The OpenAPI document `kitr api:sync` writes: `path` (default `openapi.json`), `title`, `version`, `description`. */
  openapi?: { path?: string; title?: string; version?: string; description?: string }
  /** Where the typed client lives. Declared; `kitr api:sync` does not read it yet. */
  client?: { path?: string }
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    api: ApiConfig
  }
}

/** Type the `config/api.ts` export. Returns the object unchanged. */
export const defineConfig = createDefineConfig<ApiConfig>()
