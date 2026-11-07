import { createDefineConfig } from '@kitr/core'

export type RealtimeTransport = 'websocket' | 'socket.io' | 'sse'

export interface RealtimeConfig {
  /** `websocket` (default, crossws/partysocket), `socket.io` (rooms, adapters) or `sse` (one-way events over HTTP, any host). */
  transport?: RealtimeTransport
  /** Client URL. Default: same origin at `path`. */
  url?: string
  /** Server path of the upgrade route (websocket), the SSE stream, or the Socket.IO path. Default `/ws`, `/events` for sse. */
  path?: string
  /** Heartbeat interval in ms (client pings). Default 25 000; 0 disables. */
  heartbeat?: number
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    realtime: RealtimeConfig
  }
}

export const defineConfig = createDefineConfig<RealtimeConfig>()
