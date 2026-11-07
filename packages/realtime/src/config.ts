import { createDefineConfig } from '@kitr/core'

/** Which transport carries channel traffic: native WebSocket, Socket.IO, or Server-Sent Events. */
export type RealtimeTransport = 'websocket' | 'socket.io' | 'sse'

/** The shape of `config/realtime.ts`: which transport the client uses and where it connects. */
export interface RealtimeConfig {
  /** `websocket` (default, crossws/partysocket), `socket.io` (rooms, adapters) or `sse` (one-way events over HTTP, any host). */
  transport?: RealtimeTransport
  /** Client URL. Default: same origin at `path`. */
  url?: string
  /** Server path of the upgrade route (websocket), the SSE stream, or the Socket.IO path. Default `/ws`, `/events` for sse. */
  path?: string
  /** Heartbeat interval in ms (client pings). Default 25 000; 0 disables. Not read by the built-in clients yet. */
  heartbeat?: number
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    realtime: RealtimeConfig
  }
}

/** Typed identity helper for `config/realtime.ts`. */
export const defineConfig = createDefineConfig<RealtimeConfig>()
