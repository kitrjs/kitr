import {
  defineProvider,
  KitrError,
  type KitrErrorShape,
  type KitrProvider,
  toKitrError,
  validate,
} from '@kitr/core'
import type { KitrServer } from '@kitr/server'
import { defineHandler, type H3Event, readBody } from 'h3'
import { createMemoryRealtimeAdapter, createTopicRouter, type RealtimeAdapter } from './adapter'
import {
  type ChannelDefinition,
  type ChannelParams,
  type ClientMessage,
  type ServerMessage,
  topicFor,
} from './protocol'
import { type ChannelEmitter, createRealtimeServer } from './server'

/** Options for `createSseServer`: the channels to serve, stream auth and the keep-alive interval. */
export interface SseServerOptions {
  /** Every channel clients may subscribe to. */
  channels: ChannelDefinition<any, any>[]
  /** Authenticate the stream request. Return per-connection context or throw/return false to reject. */
  authorize?: (request: Request) => unknown | Promise<unknown>
  /** Keep-alive comment interval in ms. Default 20 000. */
  keepAlive?: number
  /**
   * Carries emits, and control POSTs that land on another instance than their stream, between
   * server instances. Default: the memory adapter (this process only). Use
   * `createRedisRealtimeAdapter` when you run more than one.
   */
  adapter?: RealtimeAdapter
}

/** The realtime server for the SSE transport, as `createSseServer` returns it. */
export interface SseServer {
  /** GET opens the stream, POST carries sub/unsub/msg control messages. Mount both on one path. */
  handler: ReturnType<typeof defineHandler>
  /** Publish on a channel from an action, controller or job. */
  use<C extends ChannelDefinition<any, any>>(
    channel: C,
    params: ChannelParams<C>,
  ): ChannelEmitter<C>
  /** Register GET and POST on `path` (default `/events`) of a kitr server. */
  attach(server: KitrServer, path?: string): SseServer
  /** Number of open streams on this instance. */
  readonly connections: number
  /** The adapter emits and forwarded control messages travel through. */
  readonly adapter: RealtimeAdapter
}

interface Connection {
  id: string
  ctx: unknown
  write(chunk: string): void
  subs: Map<string, string>
  /** Stops listening for control messages forwarded from other instances. */
  off?: Promise<(() => void) | undefined>
}

/** The adapter topic a stream's own instance listens on for control POSTs that reached another. */
const controlTopic = (id: string) => `#sse:${id}`

/**
 * Realtime channels over Server-Sent Events: one streaming GET per client, control messages
 * over POST. Runs anywhere h3 runs, including hosts without WebSocket upgrades.
 */
export function createSseServer(options: SseServerOptions): SseServer {
  const channels = new Map(options.channels.map((c) => [c.name, c]))
  const adapter = options.adapter ?? createMemoryRealtimeAdapter()
  const connections = new Map<string, Connection>()
  const encoder = new TextEncoder()
  const report = (error: unknown) => console.error('[@kitr/realtime]', error)

  const frame = (data: string, event?: string) =>
    `${event ? `event: ${event}\n` : ''}data: ${data}\n\n`
  const send = (conn: Connection, msg: ServerMessage) => conn.write(frame(JSON.stringify(msg)))
  const fail = (conn: Connection, error: unknown, id?: string) =>
    send(conn, { t: 'err', id, e: toKitrError(error).toJSON() as KitrErrorShape })
  // Payloads on the adapter are the JSON message; each instance frames it for its own streams.
  const topics = createTopicRouter<Connection>(
    adapter,
    (conn, payload) => conn.write(frame(payload)),
    report,
  )
  const drop = (conn: Connection) => {
    if (!connections.has(conn.id)) return
    for (const topic of conn.subs.values()) topics.leave(conn, topic)
    connections.delete(conn.id)
    void conn.off?.then((off) => off?.())
  }

  async function stream(event: H3Event): Promise<Response> {
    const request = event.req as Request
    let ctx: unknown
    try {
      ctx = (await options.authorize?.(request)) ?? {}
      if (ctx === false) return new Response('Unauthorized', { status: 401 })
    } catch (error) {
      const e = toKitrError(error)
      return new Response(e.message, { status: e.status === 500 ? 401 : e.status })
    }
    const id = crypto.randomUUID()
    let timer: ReturnType<typeof setInterval> | undefined
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const conn: Connection = {
          id,
          ctx,
          subs: new Map(),
          write: (chunk) => {
            try {
              controller.enqueue(encoder.encode(chunk))
            } catch {}
          },
        }
        connections.set(id, conn)
        // A control POST that the load balancer sends to another instance comes back here.
        conn.off = Promise.resolve()
          .then(() =>
            adapter.subscribe(controlTopic(id), (payload) => {
              const msg = JSON.parse(payload) as ClientMessage
              if (connections.has(id)) void handle(conn, msg).catch(report)
            }),
          )
          .catch((error) => {
            report(error)
            return undefined
          })
        // Hand out the id only once forwarded messages can reach this stream.
        void conn.off.then(() => conn.write(frame(id, 'kitr:open')))
        timer = setInterval(() => conn.write(': keep-alive\n\n'), options.keepAlive ?? 20_000)
        request.signal?.addEventListener('abort', () => {
          clearInterval(timer)
          drop(conn)
          try {
            controller.close()
          } catch {}
        })
      },
      cancel() {
        clearInterval(timer)
        const conn = connections.get(id)
        if (conn) drop(conn)
      },
    })
    return new Response(body, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    })
  }

  async function control(event: H3Event): Promise<Response> {
    const id = event.req.headers.get('x-kitr-connection')
    if (!id) return new Response('Unknown connection', { status: 410 })
    const msg = (await readBody(event)) as ClientMessage
    if (!msg || typeof msg !== 'object') return new Response(null, { status: 400 })
    const conn = connections.get(id)
    if (conn) {
      await handle(conn, msg)
      return new Response(null, { status: 204 })
    }
    // The stream is on another instance: hand the message to it. Nobody listening means the
    // stream is gone everywhere, and the client opens a new one.
    let received = 0
    try {
      received = await adapter.publish(controlTopic(id), JSON.stringify(msg))
    } catch (error) {
      report(error)
      return new Response('Realtime adapter unavailable', { status: 503 })
    }
    if (received === 0) return new Response('Unknown connection', { status: 410 })
    return new Response(null, { status: 204 })
  }

  /** Run one control message for a stream on this instance; errors go down the stream. */
  async function handle(conn: Connection, msg: ClientMessage): Promise<void> {
    if (msg.t === 'ping') return
    if (msg.t === 'unsub') {
      const topic = conn.subs.get(msg.id)
      if (topic) {
        conn.subs.delete(msg.id)
        topics.leave(conn, topic)
      }
      return
    }
    const channel = channels.get(msg.ch)
    const msgId = 'id' in msg ? msg.id : undefined
    if (!channel) return fail(conn, KitrError.notFound(`Channel "${msg.ch}"`), msgId)
    let params = msg.p
    if (channel.params) {
      const result = await validate(channel.params, msg.p)
      if (!result.success) return fail(conn, KitrError.validation(result.fieldErrors), msgId)
      params = result.data
    }
    try {
      if (channel.authorize && !(await channel.authorize(params, conn.ctx)))
        throw KitrError.forbidden(`Not allowed on channel "${msg.ch}"`)
      if (msg.t === 'sub') {
        const topic = topicFor(channel.name, params)
        // Re-using an id replaces that subscription; leave its old topic first.
        const previous = conn.subs.get(msg.id)
        if (previous && previous !== topic) topics.leave(conn, previous)
        conn.subs.set(msg.id, topic)
        await topics.join(conn, topic)
        // Send the params back as the schema output them: the server publishes under those.
        send(conn, { t: 'ok', id: msg.id, p: params ?? null })
      } else if (msg.t === 'msg') {
        await channel.onMessage?.(msg.ev, msg.d, params, conn.ctx, sse)
      }
    } catch (error) {
      fail(conn, error, msgId)
    }
  }

  const handler = defineHandler((event) =>
    event.req.method === 'POST' ? control(event) : stream(event),
  )

  const sse: SseServer = {
    handler,
    adapter,
    get connections() {
      return connections.size
    },
    use(channel, params) {
      const topic = topicFor(channel.name, params)
      return {
        get size() {
          return topics.size(topic)
        },
        emit(event, data) {
          topics.publish(
            topic,
            JSON.stringify({
              t: 'ev',
              ch: channel.name,
              p: params ?? null,
              ev: event,
              d: data,
            } satisfies ServerMessage),
          )
        },
      }
    },
    attach(server, path = '/events') {
      server.h3.get(path, handler)
      server.h3.post(path, handler)
      return sse
    },
  }
  return sse
}

/** A provider that binds an SSE realtime server as `realtime` in the container. It does not attach the route. */
export function sseProvider(options: SseServerOptions): KitrProvider {
  return defineProvider({
    name: 'realtime',
    register(app) {
      app.container.singleton('realtime', () =>
        createRealtimeServer({ ...options, transport: 'sse' }),
      )
    },
  })
}
