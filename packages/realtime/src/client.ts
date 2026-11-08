import {
  type CacheEffect,
  KitrError,
  type KitrErrorShape,
  type QueryKey,
  type SubscriptionContract,
  validateSync,
} from '@kitr/core'
import { keyFor, toEnvelope } from '@kitr/core/request'
import ReconnectingWebSocket from 'partysocket/ws'
import {
  type ChannelDefinition,
  type ChannelEventUnion,
  type ChannelParams,
  type ClientMessage,
  parseMessage,
  type ServerMessage,
  topicFor,
} from './protocol'

/** Options for `createSocketClient`, the native WebSocket transport. */
export interface SocketClientOptions {
  /** `ws://` or `wss://` URL, or a function (e.g. to append a token). */
  url: string | (() => string | Promise<string>)
  /** WebSocket subprotocols, passed to the WebSocket constructor. */
  protocols?: string | string[]
  /** Reconnect settings passed to partysocket. */
  reconnect?: { maxRetries?: number; minReconnectionDelay?: number; maxReconnectionDelay?: number }
  /** Called for every server error that isn't tied to a subscription. */
  onError?: (error: KitrErrorShape) => void
  /**
   * Ping interval in ms while open. A connection that has not answered the previous ping by the
   * next one is treated as dead and reconnected. Default 25 000; 0 disables.
   */
  heartbeat?: number
}

/** The connection state a transport reports: connecting, open or closed. */
export type SocketStatus = 'connecting' | 'open' | 'closed'

/**
 * What every realtime client implements: WebSocket, Socket.IO, SSE, or your own.
 * `channel()` and `useChannel()` only talk to this interface.
 */
export interface SocketTransport {
  /** Subscribe to a channel topic. Returns a function that unsubscribes. */
  subscribe(
    channel: string,
    params: unknown,
    onEvent: (event: string, data: unknown) => void,
    onError?: (e: KitrErrorShape) => void,
  ): () => void
  /** Send a client event up a channel; the server hands it to the channel's `onMessage`. */
  send(channel: string, params: unknown, event: string, data: unknown): void
  /** Close the connection and stop reconnecting. */
  close(): void
  /** The current connection state. */
  readonly status: SocketStatus
  /** Listen for status changes. Returns a function that removes the listener. */
  onStatus(listener: (status: SocketStatus) => void): () => void
}

interface Sub {
  id: string
  channel: string
  params: unknown
  /** Where events for this subscription arrive: the server's normalised params. */
  topic: string
  onEvent: (event: string, data: unknown) => void
  onError?: (e: KitrErrorShape) => void
}

/**
 * The native WebSocket transport (partysocket underneath: reconnects, buffers
 * while offline). Subscriptions are re-sent after every reconnect.
 */
export function createSocketClient(options: SocketClientOptions): SocketTransport {
  const ws = new ReconnectingWebSocket(options.url as any, options.protocols, {
    startClosed: false,
    ...options.reconnect,
  })
  const subs = new Map<string, Sub>()
  const byTopic = new Map<string, Set<Sub>>()
  const statusListeners = new Set<(s: SocketStatus) => void>()
  let status: SocketStatus = 'connecting'
  let counter = 0

  const setStatus = (s: SocketStatus) => {
    status = s
    for (const l of statusListeners) l(s)
  }
  const send = (msg: ClientMessage) => ws.send(JSON.stringify(msg))
  const unindex = (sub: Sub) => {
    const set = byTopic.get(sub.topic)
    set?.delete(sub)
    if (set?.size === 0) byTopic.delete(sub.topic)
  }
  const index = (sub: Sub, topic: string) => {
    unindex(sub)
    sub.topic = topic
    let set = byTopic.get(topic)
    if (!set) {
      set = new Set()
      byTopic.set(topic, set)
    }
    set.add(sub)
  }

  // Proxies and load balancers drop idle sockets without a close frame; pings keep the socket
  // busy, and a missing pong shows the connection is gone so it can reconnect.
  const heartbeat = options.heartbeat ?? 25_000
  let pinger: ReturnType<typeof setInterval> | undefined
  let awaitingPong = false
  const stopHeartbeat = () => {
    if (pinger) clearInterval(pinger)
    pinger = undefined
    awaitingPong = false
  }
  const startHeartbeat = () => {
    stopHeartbeat()
    if (!(heartbeat > 0)) return
    pinger = setInterval(() => {
      if (awaitingPong) {
        stopHeartbeat()
        ws.reconnect()
        return
      }
      awaitingPong = true
      send({ t: 'ping' })
    }, heartbeat)
  }

  ws.addEventListener('open', () => {
    setStatus('open')
    startHeartbeat()
    for (const sub of subs.values()) send({ t: 'sub', id: sub.id, ch: sub.channel, p: sub.params })
  })
  ws.addEventListener('close', () => {
    stopHeartbeat()
    setStatus('closed')
  })
  ws.addEventListener('message', (e) => {
    const msg = parseMessage<ServerMessage>((e as MessageEvent).data)
    if (!msg) return
    awaitingPong = false
    if (msg.t === 'ev') {
      for (const sub of byTopic.get(topicFor(msg.ch, msg.p)) ?? []) sub.onEvent(msg.ev, msg.d)
    } else if (msg.t === 'ok' && 'p' in msg) {
      // The channel's params schema may have transformed the params (trim, lowercase,
      // coerce); the server publishes under those, so listen there.
      const sub = subs.get(msg.id)
      if (sub) index(sub, topicFor(sub.channel, msg.p))
    } else if (msg.t === 'err') {
      const sub = msg.id ? subs.get(msg.id) : undefined
      if (sub?.onError) sub.onError(msg.e)
      else options.onError?.(msg.e)
    }
  })

  return {
    get status() {
      return status
    },
    onStatus(listener) {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    subscribe(channel, params, onEvent, onError) {
      const id = `s${++counter}`
      const topic = topicFor(channel, params)
      const sub: Sub = { id, channel, params, topic, onEvent, onError }
      subs.set(id, sub)
      index(sub, topic)
      if (ws.readyState === ws.OPEN) send({ t: 'sub', id, ch: channel, p: params })
      return () => {
        subs.delete(id)
        unindex(sub)
        if (ws.readyState === ws.OPEN) send({ t: 'unsub', id })
      }
    },
    send(channel, params, event, data) {
      send({ t: 'msg', ch: channel, p: params, ev: event, d: data })
    },
    close() {
      stopHeartbeat()
      ws.close()
    },
  }
}

/** A channel bound to a transport, as `channel()` returns it. */
export interface ChannelHandle<C extends ChannelDefinition<any, any>> {
  /** A subscription contract for `useSubscription` (@kitr/query) or `subscriptionFrom`. */
  subscription(): SubscriptionContract<ChannelParams<C>, ChannelEventUnion<C>>
  /** Send a client event up the channel. */
  send<E extends keyof C['events'] & string>(
    params: ChannelParams<C>,
    event: E,
    data: unknown,
  ): void
  /** The query key of a subscription: `['realtime', name, params]`. */
  key(params: ChannelParams<C>): QueryKey
}

/**
 * Bind a channel definition to a transport. Events validated by their schema
 * (when given) are handed to `effects`, which `useSubscription` applies to the cache.
 */
export function channel<C extends ChannelDefinition<any, any>>(
  transport: SocketTransport,
  definition: C,
): ChannelHandle<C> {
  const key = (params: ChannelParams<C>): QueryKey =>
    keyFor('realtime', definition.name, params ?? null)
  return {
    key,
    send: (params, event, data) => transport.send(definition.name, params, event, data),
    subscription: () => ({
      kind: 'subscription',
      source: 'realtime',
      key,
      subscribe: (params, handlers) =>
        transport.subscribe(
          definition.name,
          params,
          (event, data) => {
            const def = definition.events[event]
            if (!def) return
            let payload = data
            if (def.schema) {
              const result = validateSync(def.schema, data)
              if (!result.success) {
                handlers.error?.(
                  toEnvelope(
                    KitrError.validation(
                      result.fieldErrors,
                      `Invalid payload for ${definition.name}.${event}`,
                    ),
                  ),
                )
                return
              }
              payload = result.data
            }
            handlers.next({ event, data: payload } as ChannelEventUnion<C>)
          },
          handlers.error,
        ),
      effects: (incoming, params) => {
        const def = definition.events[(incoming as { event: string }).event]
        return (def?.effects?.((incoming as { data: unknown }).data, params) ??
          undefined) as CacheEffect | void
      },
    }),
  }
}

/** Alias: the transport interface every realtime client implements. */
export type RealtimeTransport = SocketTransport
/** Alias of `SocketStatus`. */
export type RealtimeStatus = SocketStatus
/** The native WebSocket transport (same as `createSocketClient`). */
export const createWebSocketTransport = createSocketClient
