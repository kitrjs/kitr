import { type SocketTransport, createSocketClient } from '@kitr/realtime'
import realtimeConfig from '#config/realtime'

let transport: SocketTransport | undefined

/** One connection per tab, opened on first use (so nothing connects during SSR). */
export function getSocket(): SocketTransport {
  transport ??= createSocketClient({
    url: () => window.location.origin.replace(/^http/, 'ws') + realtimeConfig.path,
  })
  return transport
}
