import { type SocketTransport, createSocketClient } from 'kitr/socket'
import socketConfig from '#config/socket'

let transport: SocketTransport | undefined

/** One connection per tab, opened on first use (so nothing connects during SSR). */
export function getSocket(): SocketTransport {
  transport ??= createSocketClient({
    url: () => window.location.origin.replace(/^http/, 'ws') + socketConfig.path,
  })
  return transport
}
