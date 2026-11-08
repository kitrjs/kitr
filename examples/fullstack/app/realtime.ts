import { createRealtimeClient, type SocketTransport } from '@kitr/realtime'
import realtimeConfig from '#config/realtime'

let transport: SocketTransport | undefined

/** One connection per tab, opened on first use (so nothing connects during SSR). */
export function realtime(): SocketTransport {
  transport ??= createRealtimeClient(realtimeConfig)
  return transport
}
