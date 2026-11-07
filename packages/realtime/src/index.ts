export * from './client'
export {
  defineConfig,
  type RealtimeConfig,
  type RealtimeTransport as RealtimeTransportName,
} from './config'
export * from './protocol'
export { createSseTransport, type SseTransportOptions } from './sse'

import { createSocketClient, type SocketTransport } from './client'
import type { RealtimeConfig } from './config'
import { createSseTransport } from './sse'

/**
 * Creates the client transport `config/realtime.ts` names: websocket (default) or sse here; socket.io loads its
 * client from `kitr/realtime/socket.io` so the dependency stays optional.
 *
 *   let transport: SocketTransport | undefined
 *   export const realtime = () => (transport ??= createRealtimeClient(realtimeConfig))
 *
 * Call it lazily, as above, so nothing connects during SSR.
 */
export function createRealtimeClient(config: RealtimeConfig = {}): SocketTransport {
  const transport = config.transport ?? 'websocket'
  if (transport === 'socket.io')
    throw new Error(
      '[kitr/realtime] transport "socket.io": create the client with createSocketIoClient() from kitr/realtime/socket.io',
    )
  if (transport === 'sse')
    return createSseTransport({ url: config.url ?? config.path ?? '/events' })
  return createSocketClient({
    heartbeat: config.heartbeat,
    url: () =>
      config.url ?? `${window.location.origin.replace(/^http/, 'ws')}${config.path ?? '/ws'}`,
  })
}
