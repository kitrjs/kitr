import { createDefineConfig } from '@kitr/core'

export interface SocketConfig {
  /** Client URL. Default: same origin, `/ws`. */
  url?: string
  /** Server path for the upgrade route. Default `/ws`. */
  path?: string
  /** Heartbeat interval in ms (client pings). Default 25 000; 0 disables. */
  heartbeat?: number
  transport?: 'websocket' | 'socket.io'
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    socket: SocketConfig
  }
}

export const defineConfig = createDefineConfig<SocketConfig>()
