import type { KitrErrorShape } from '@kitr/core'
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client'
import type { SocketStatus, SocketTransport } from './client'
import { type ServerMessage, topicFor } from './protocol'

export { channel } from './client'
export { defineChannel } from './protocol'

/** Options for `createSocketIoClient`: any socket.io-client option plus the server URL and an error handler. */
export interface SocketIoClientOptions extends Partial<ManagerOptions & SocketOptions> {
  /** Server URL. Default: the page's origin. */
  url?: string
  /** Called for every server error that isn't tied to a subscription. */
  onError?: (error: KitrErrorShape) => void
}

/**
 * Creates the same `SocketTransport` as kitr/realtime, over Socket.IO; `.socket` is the raw socket.io-client socket. Use it with `channel()`
 * from kitr/realtime/socket.io; the channel definitions and `useSubscription` don't change.
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
  const topicOf = new Map<string, string>()
  const index = (id: string, topic: string) => {
    const old = topicOf.get(id)
    if (old !== undefined) {
      byTopic.get(old)?.delete(id)
      if (byTopic.get(old)?.size === 0) byTopic.delete(old)
    }
    topicOf.set(id, topic)
    let set = byTopic.get(topic)
    if (!set) {
      set = new Set()
      byTopic.set(topic, set)
    }
    set.add(id)
  }
  const unindex = (id: string) => {
    const old = topicOf.get(id)
    topicOf.delete(id)
    if (old === undefined) return
    byTopic.get(old)?.delete(id)
    if (byTopic.get(old)?.size === 0) byTopic.delete(old)
  }
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
    } else if (msg.t === 'ok' && 'p' in msg) {
      // Listen under the params the server normalised (the channel schema may transform them).
      const sub = subs.get(msg.id)
      if (sub) index(msg.id, topicFor(sub.channel, msg.p))
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
      subs.set(id, { channel, params, onEvent, onError: onErrorSub })
      index(id, topicFor(channel, params))
      if (socket.connected) socket.emit('kitr', { t: 'sub', id, ch: channel, p: params })
      return () => {
        subs.delete(id)
        unindex(id)
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
