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
import type { RealtimeConfig, RealtimeTransport } from './config'
import {
  type ChannelDefinition,
  type ChannelParams,
  type ClientMessage,
  parseMessage,
  type ServerMessage,
  topicFor,
} from './protocol'
import { createSseServer } from './sse-server'

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

/** Options for `createRealtimeServer`: the channels, plus the transport and path from `config/realtime.ts`. */
export interface RealtimeServerOptions extends SocketServerOptions, RealtimeConfig {
  /** SSE only: keep-alive comment interval in ms. Default 20 000. */
  keepAlive?: number
}

/** The realtime server for whichever transport `config/realtime.ts` names: websocket or sse. */
export interface RealtimeServer {
  /** Which transport this server speaks. */
  readonly transport: Exclude<RealtimeTransport, 'socket.io'>
  /** Publish on a channel from an action, controller or job. */
  use<C extends ChannelDefinition<any, any>>(
    channel: C,
    params: ChannelParams<C>,
  ): ChannelEmitter<C>
  /** Register the route on a kitr server: at `path`, else the `path` option, else `/ws` (websocket) or `/events` (sse). */
  attach(server: KitrServer, path?: string): RealtimeServer
  /** Number of open connections or streams. */
  readonly connections: number
}

/**
 * Creates the realtime server for the transport in `config/realtime.ts`, so switching transports
 * there changes both ends. Pass the config straight in:
 *
 *   import realtimeConfig from '../config/realtime'
 *   export const realtime = createRealtimeServer({ ...realtimeConfig, channels: [chatChannel] })
 *   realtime.attach(server) // at realtimeConfig.path
 *
 * Socket.IO needs a Socket.IO `Server`, so it throws here: use `attachSocketIo` from
 * `kitr/realtime/socket.io/server` instead.
 */
export function createRealtimeServer(options: RealtimeServerOptions): RealtimeServer {
  const transport = options.transport ?? 'websocket'
  if (transport === 'socket.io')
    throw new Error(
      '[kitr/realtime] transport "socket.io": serve channels with attachSocketIo(io, { channels }) from kitr/realtime/socket.io/server',
    )
  const inner =
    transport === 'sse'
      ? createSseServer({
          channels: options.channels,
          authorize: options.authorize,
          keepAlive: options.keepAlive,
        })
      : createSocketServer({ channels: options.channels, authorize: options.authorize })
  const realtime: RealtimeServer = {
    transport,
    use: (channel, params) => inner.use(channel, params),
    attach(server, path) {
      inner.attach(server, path ?? options.path)
      return realtime
    },
    get connections() {
      return inner.connections
    },
  }
  return realtime
}

declare module '@kitr/core' {
  interface ContainerBindings {
    realtime: RealtimeServer
  }
}

/**
 * A provider that binds the realtime server as `realtime` in the container, for the transport and
 * path in `config/realtime.ts` (options given here win). It does not register the route, because
 * the provider has no server: call `app.container.use('realtime').attach(server)` after boot.
 */
export function realtimeProvider(options: RealtimeServerOptions): KitrProvider {
  return defineProvider({
    name: 'realtime',
    register(app) {
      app.container.singleton('realtime', () =>
        createRealtimeServer({
          ...(app.config.has('realtime') ? app.config.get('realtime') : {}),
          ...options,
        }),
      )
    },
  })
}
