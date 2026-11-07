import type { KitrErrorShape } from '@kitr/core'
import type { ServerMessage, SocketStatus, SocketTransport } from '@kitr/socket'
import { topicFor } from '@kitr/socket'
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client'

export { channel, defineChannel } from '@kitr/socket'

export interface SocketIoClientOptions extends Partial<ManagerOptions & SocketOptions> {
  url?: string
  onError?: (error: KitrErrorShape) => void
}

/**
 * The same `SocketTransport` as kitr/socket, over Socket.IO. Use it with `channel()`
 * from kitr/socket.io; the channel definitions and `useSubscription` don't change.
 */
export function createSocketIoClient(
  options: SocketIoClientOptions = {},
): SocketTransport & { socket: Socket } {
  const { url, onError, ...ioOptions } = options
  const socket = url ? io(url, ioOptions) : io(ioOptions)
  const subs = new Map<
    string,
    {
      channel: string
      params: unknown
      onEvent: (e: string, d: unknown) => void
      onError?: (e: KitrErrorShape) => void
    }
  >()
  const byTopic = new Map<string, Set<string>>()
  const listeners = new Set<(s: SocketStatus) => void>()
  let counter = 0
  const emitStatus = (s: SocketStatus) => {
    for (const l of listeners) l(s)
  }
  socket.on('connect', () => {
    emitStatus('open')
    for (const [id, sub] of subs)
      socket.emit('kitr', { t: 'sub', id, ch: sub.channel, p: sub.params })
  })
  socket.on('disconnect', () => emitStatus('closed'))
  socket.on('kitr', (msg: ServerMessage) => {
    if (msg.t === 'ev') {
      for (const id of byTopic.get(topicFor(msg.ch, msg.p)) ?? [])
        subs.get(id)?.onEvent(msg.ev, msg.d)
    } else if (msg.t === 'err') {
      const sub = msg.id ? subs.get(msg.id) : undefined
      if (sub?.onError) sub.onError(msg.e)
      else onError?.(msg.e)
    }
  })
  return {
    socket,
    get status(): SocketStatus {
      return socket.connected ? 'open' : socket.active ? 'connecting' : 'closed'
    },
    onStatus(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    subscribe(channel, params, onEvent, onErrorSub) {
      const id = `s${++counter}`
      const topic = topicFor(channel, params)
      subs.set(id, { channel, params, onEvent, onError: onErrorSub })
      let set = byTopic.get(topic)
      if (!set) {
        set = new Set()
        byTopic.set(topic, set)
      }
      set.add(id)
      if (socket.connected) socket.emit('kitr', { t: 'sub', id, ch: channel, p: params })
      return () => {
        subs.delete(id)
        set.delete(id)
        if (set.size === 0) byTopic.delete(topic)
        if (socket.connected) socket.emit('kitr', { t: 'unsub', id })
      }
    },
    send(channel, params, event, data) {
      socket.emit('kitr', { t: 'msg', ch: channel, p: params, ev: event, d: data })
    },
    close() {
      socket.close()
    },
  }
}
