import { createDefineConfig } from '@kitr/core'

export interface ServerConfig {
  port?: number
  host?: string
  /** Path for a liveness route returning `{ ok: true }`. `false` disables. Default `/healthz`. */
  healthPath?: string | false
  /** Max request body in bytes. Default 1 MiB. */
  bodyLimit?: number
  /** Trust `X-Forwarded-*` from a proxy in front of the server. */
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

export const defineConfig = createDefineConfig<ServerConfig>()
