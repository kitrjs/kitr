import { createDefineConfig } from '@kitr/core'

/** Options for the kitr server, read from `config/server.ts` or passed as `createServer({ server })`. */
export interface ServerConfig {
  /** Port `listen()` uses when called without one. Default 3000. */
  port?: number
  /** Interface `listen()` binds when called without one. Default `0.0.0.0`. */
  host?: string
  /** Path for a liveness route returning `{ ok: true }`. `false` disables. Default `/healthz`. */
  healthPath?: string | false
  /** Max request body in bytes. Default 1 MiB. */
  bodyLimit?: number
  /** Reserved for trusting `X-Forwarded-*` from a proxy in front of the server. Not read by the server yet. */
  trustProxy?: boolean
  /** Enable the WebSocket upgrade (needs `crossws`). Set by `@kitr/realtime`. */
  websocket?: boolean
  /** Header name for the request id. Default `x-request-id`. */
  requestIdHeader?: string
  /** Seconds to wait for in-flight requests on shutdown. Default 10. */
  shutdownTimeout?: number
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    server: ServerConfig
  }
}

/** Type the `config/server.ts` export. Returns the object unchanged. */
export const defineConfig = createDefineConfig<ServerConfig>()
