import type { KitrErrorShape } from '@kitr/core'
import type { SocketStatus, SocketTransport } from './client'
import { type ClientMessage, parseMessage, type ServerMessage, topicFor } from './protocol'

/** Options for `createSseTransport`, the Server-Sent Events client. */
export interface SseTransportOptions {
  /** The stream URL (`/events`). Control messages are POSTed to the same URL. */
  url: string | (() => string)
  /** Extra headers for control requests (the stream itself cannot carry headers; use cookies or a `?token=`). */
  headers?: Record<string, string> | (() => Record<string, string>)
  /** Called for server errors not tied to a subscription, and for failed control requests (`NETWORK`). */
  onError?: (error: KitrErrorShape) => void
}

/**
 * Server-Sent Events as a realtime transport: the server pushes over one `EventSource`,
 * the client subscribes and sends with plain `fetch` POSTs. Works through any HTTP host
 * and proxy, no upgrade needed. Same channels, same `useSubscription`.
 */
export function createSseTransport(options: SseTransportOptions): SocketTransport {
  const url = () => (typeof options.url === 'function' ? options.url() : options.url)
  const headers = () =>
    typeof options.headers === 'function' ? options.headers() : (options.headers ?? {})
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
  let status: SocketStatus = 'connecting'
  let counter = 0
  let connectionId: string | undefined
  let source: EventSource | undefined

  const setStatus = (s: SocketStatus) => {
    status = s
    for (const l of listeners) l(s)
  }
  const post = async (msg: ClientMessage) => {
    if (!connectionId) return
    try {
      await fetch(url(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kitr-connection': connectionId,
          ...headers(),
        },
        body: JSON.stringify(msg),
      })
    } catch (error) {
      options.onError?.({ code: 'NETWORK', message: String(error), status: 0 })
    }
  }
  const open = () => {
    if (typeof EventSource === 'undefined') return
    source = new EventSource(url(), { withCredentials: true })
    source.addEventListener('kitr:open', (e) => {
      connectionId = (e as MessageEvent).data
      setStatus('open')
      for (const [id, sub] of subs) void post({ t: 'sub', id, ch: sub.channel, p: sub.params })
    })
    source.addEventListener('message', (e) => {
      const msg = parseMessage<ServerMessage>((e as MessageEvent).data)
      if (!msg) return
      if (msg.t === 'ev') {
        for (const id of byTopic.get(topicFor(msg.ch, msg.p)) ?? [])
          subs.get(id)?.onEvent(msg.ev, msg.d)
      } else if (msg.t === 'err') {
        const sub = msg.id ? subs.get(msg.id) : undefined
        if (sub?.onError) sub.onError(msg.e)
        else options.onError?.(msg.e)
      }
    })
    source.addEventListener('error', () => {
      // EventSource reconnects on its own; the server hands out a new connection id on `kitr:open`.
      connectionId = undefined
      setStatus(source?.readyState === EventSource.CLOSED ? 'closed' : 'connecting')
    })
  }
  open()

  return {
    get status() {
      return status
    },
    onStatus(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    subscribe(channel, params, onEvent, onError) {
      const id = `s${++counter}`
      const topic = topicFor(channel, params)
      subs.set(id, { channel, params, onEvent, onError })
      let set = byTopic.get(topic)
      if (!set) {
        set = new Set()
        byTopic.set(topic, set)
      }
      set.add(id)
      void post({ t: 'sub', id, ch: channel, p: params })
      return () => {
        subs.delete(id)
        set.delete(id)
        if (set.size === 0) byTopic.delete(topic)
        void post({ t: 'unsub', id })
      }
    },
    send(channel, params, event, data) {
      void post({ t: 'msg', ch: channel, p: params, ev: event, d: data })
    },
    close() {
      source?.close()
      source = undefined
      connectionId = undefined
      setStatus('closed')
    },
  }
}
