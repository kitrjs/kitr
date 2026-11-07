import {
  defineProvider,
  KitrError,
  type KitrErrorShape,
  type KitrProvider,
  toKitrError,
  validate,
} from '@kitr/core'
import type { KitrServer } from '@kitr/server'
import type { Peer } from 'crossws'
import { defineWebSocketHandler } from 'h3'
import {
  type ChannelDefinition,
  type ChannelParams,
  type ClientMessage,
  parseMessage,
  type ServerMessage,
  topicFor,
} from './protocol'

/** Options for `createSocketServer`: the channels it serves and how it authenticates connections. */
export interface SocketServerOptions {
  /** Every channel clients may subscribe to. Subscribing to any other name fails with `NOT_FOUND`. */
  channels: ChannelDefinition<any, any>[]
  /** Authenticate the upgrade. Return per-connection context (e.g. the user) or throw/return false to reject. */
  authorize?: (request: Request) => unknown | Promise<unknown>
}

/** Publishes events to every subscriber of one channel topic, as `server.use(channel, params)` returns it. */
export interface ChannelEmitter<C extends ChannelDefinition<any, any>> {
  /** Send an event to every connection subscribed to this topic. A topic with no subscribers is a no-op. */
  emit<E extends keyof C['events'] & string>(
    event: E,
    data: C['events'][E] extends { schema: infer S }
      ? S extends { '~standard': { types?: { output: infer O } } }
        ? O
        : unknown
      : unknown,
  ): void
  /** Subscriber count for this topic. */
  readonly size: number
}

/** The realtime server for the native WebSocket transport, as `createRealtimeServer` returns it. */
export interface SocketServer {
  /** The h3 handler for the upgrade route: `server.h3.get('/ws', socket.handler)`. */
  handler: ReturnType<typeof defineWebSocketHandler>
  /** Publish on a channel from an action, controller or job. */
  use<C extends ChannelDefinition<any, any>>(
    channel: C,
    params: ChannelParams<C>,
  ): ChannelEmitter<C>
  /** Attach to a kitr server: registers the route and enables the upgrade. */
  attach(server: KitrServer, path?: string): SocketServer
  /** Number of open connections. */
  readonly connections: number
}

interface PeerState {
  ctx: unknown
  subs: Map<string, { topic: string; channel: ChannelDefinition<any, any>; params: unknown }>
}

/**
 * Creates the native WebSocket server on crossws (via h3). Runs on Node, Bun, Deno and Cloudflare.
 * Attach it to a kitr server with `attach(server, path)`; emit with `use(channel, params).emit()`.
 */
export function createSocketServer(options: SocketServerOptions): SocketServer {
  const channels = new Map(options.channels.map((c) => [c.name, c]))
  const topics = new Map<string, Set<Peer>>()
  const peers = new Map<Peer, PeerState>()

  const send = (peer: Peer, msg: ServerMessage): void => {
    peer.send(JSON.stringify(msg))
  }
  const fail = (peer: Peer, error: unknown, id?: string) =>
    send(peer, { t: 'err', id, e: toKitrError(error).toJSON() as KitrErrorShape })

  const handler = defineWebSocketHandler({
    async upgrade(request) {
      try {
        const ctx = (await options.authorize?.(request as Request)) ?? {}
        if (ctx === false) return new Response('Unauthorized', { status: 401 })
        return { context: { kitrCtx: ctx } }
      } catch (error) {
        const e = toKitrError(error)
        return new Response(e.message, { status: e.status === 500 ? 401 : e.status })
      }
    },
    open(peer) {
      peers.set(peer, { ctx: (peer.context as any).kitrCtx ?? {}, subs: new Map() })
    },
    close(peer) {
      const state = peers.get(peer)
      if (!state) return
      for (const { topic } of state.subs.values()) leave(peer, topic)
      peers.delete(peer)
    },
    async message(peer, message) {
      const msg = parseMessage<ClientMessage>(message.text())
      const state = peers.get(peer)
      if (!msg || !state) return
      if (msg.t === 'ping') return send(peer, { t: 'pong' })
      if (msg.t === 'unsub') {
        const sub = state.subs.get(msg.id)
        if (sub) {
          state.subs.delete(msg.id)
          leave(peer, sub.topic)
        }
        return
      }
      const channel = channels.get(msg.ch)
      if (!channel)
        return fail(
          peer,
          KitrError.notFound(`Channel "${msg.ch}"`),
          'id' in msg ? msg.id : undefined,
        )
      let params = msg.p
      if (channel.params) {
        const result = await validate(channel.params, msg.p)
        if (!result.success)
          return fail(
            peer,
            KitrError.validation(result.fieldErrors),
            'id' in msg ? msg.id : undefined,
          )
        params = result.data
      }
      try {
        if (channel.authorize && !(await channel.authorize(params, state.ctx)))
          throw KitrError.forbidden(`Not allowed on channel "${msg.ch}"`)
        if (msg.t === 'sub') {
          const topic = topicFor(channel.name, params)
          // Re-using an id replaces that subscription; leave its old topic first.
          const previous = state.subs.get(msg.id)
          if (previous && previous.topic !== topic) leave(peer, previous.topic)
          state.subs.set(msg.id, { topic, channel, params })
          let set = topics.get(topic)
          if (!set) {
            set = new Set()
            topics.set(topic, set)
          }
          set.add(peer)
          send(peer, { t: 'ok', id: msg.id, p: params ?? null })
        } else if (msg.t === 'msg') {
          await channel.onMessage?.(msg.ev, msg.d, params, state.ctx, socketServer)
        }
      } catch (error) {
        fail(peer, error, 'id' in msg ? msg.id : undefined)
      }
    },
    error(peer, error) {
      console.error('[kitr/realtime] peer error', peer.id, error)
    },
  })

  function leave(peer: Peer, topic: string) {
    const set = topics.get(topic)
    if (!set) return
    set.delete(peer)
    if (set.size === 0) topics.delete(topic)
  }

  const socketServer: SocketServer = {
    handler,
    get connections() {
      return peers.size
    },
    use(channel, params) {
      const topic = topicFor(channel.name, params)
      return {
        get size() {
          return topics.get(topic)?.size ?? 0
        },
        emit(event, data) {
          const payload = JSON.stringify({
            t: 'ev',
            ch: channel.name,
            p: params ?? null,
            ev: event,
            d: data,
          } satisfies ServerMessage)
          for (const peer of topics.get(topic) ?? []) peer.send(payload)
        },
      }
    },
    attach(server, path = '/ws') {
      server.config.websocket = true
      server.h3.get(path, handler)
      return socketServer
    },
  }
  return socketServer
}

declare module '@kitr/core' {
  interface ContainerBindings {
    realtime: SocketServer
  }
}

/**
 * A provider that binds a WebSocket server as `realtime` in the container. It does not attach the
 * route: call `attach()` on the bound server yourself. `path` is accepted but not used.
 */
export function realtimeProvider(options: SocketServerOptions & { path?: string }): KitrProvider {
  return defineProvider({
    name: 'realtime',
    register(app) {
      app.container.singleton('realtime', () => createSocketServer(options))
    },
  })
}

/** The WebSocket server factory under its transport-neutral name; same as `createSocketServer`. */
export const createRealtimeServer = createSocketServer
/** Alias of `SocketServer`. */
export type RealtimeServer = SocketServer
