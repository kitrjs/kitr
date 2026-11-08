import { createDefineConfig } from '@kitr/core'

/** Options in `config/api.ts`, read by `kitr api:sync`. */
export interface ApiConfig {
  /**
   * The prefix every route shares, e.g. `/api`: what the web app forwards to the server. Set the
   * routes' prefix with `router.group({ prefix })`; `kitr api:sync` warns about routes outside it.
   */
  prefix?: string
  /** The OpenAPI document `kitr api:sync` writes: `path` (default `openapi.json`), `title`, `version`, `description`. */
  openapi?: { path?: string; title?: string; version?: string; description?: string }
  /** Where the typed client lives (default `app/api/client.ts`). `kitr api:sync` writes `routes.gen.ts` next to it. */
  client?: { path?: string }
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    api: ApiConfig
  }
}

/** Type the `config/api.ts` export. Returns the object unchanged. */
export const defineConfig = createDefineConfig<ApiConfig>()
