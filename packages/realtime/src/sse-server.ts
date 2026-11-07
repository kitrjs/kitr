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
import {
  type ChannelDefinition,
  type ChannelParams,
  type ClientMessage,
  type ServerMessage,
  topicFor,
} from './protocol'
import type { ChannelEmitter } from './server'

/** Options for `createSseServer`: the channels to serve, stream auth and the keep-alive interval. */
export interface SseServerOptions {
  /** Every channel clients may subscribe to. */
  channels: ChannelDefinition<any, any>[]
  /** Authenticate the stream request. Return per-connection context or throw/return false to reject. */
  authorize?: (request: Request) => unknown | Promise<unknown>
  /** Keep-alive comment interval in ms. Default 20 000. */
  keepAlive?: number
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
  /** Number of open streams. */
  readonly connections: number
}

interface Connection {
  id: string
  ctx: unknown
  write(chunk: string): void
  subs: Map<string, string>
}

/**
 * Realtime channels over Server-Sent Events: one streaming GET per client, control messages
 * over POST. Runs anywhere h3 runs, including hosts without WebSocket upgrades.
 */
export function createSseServer(options: SseServerOptions): SseServer {
  const channels = new Map(options.channels.map((c) => [c.name, c]))
  const topics = new Map<string, Set<Connection>>()
  const connections = new Map<string, Connection>()
  const encoder = new TextEncoder()

  const frame = (data: string, event?: string) =>
    `${event ? `event: ${event}\n` : ''}data: ${data}\n\n`
  const send = (conn: Connection, msg: ServerMessage) => conn.write(frame(JSON.stringify(msg)))
  const fail = (conn: Connection, error: unknown, id?: string) =>
    send(conn, { t: 'err', id, e: toKitrError(error).toJSON() as KitrErrorShape })
  const leave = (conn: Connection, topic: string) => {
    const set = topics.get(topic)
    if (!set) return
    set.delete(conn)
    if (set.size === 0) topics.delete(topic)
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
        conn.write(frame(id, 'kitr:open'))
        timer = setInterval(() => conn.write(': keep-alive\n\n'), options.keepAlive ?? 20_000)
        request.signal?.addEventListener('abort', () => {
          clearInterval(timer)
          for (const topic of conn.subs.values()) leave(conn, topic)
          connections.delete(id)
          try {
            controller.close()
          } catch {}
        })
      },
      cancel() {
        clearInterval(timer)
        const conn = connections.get(id)
        if (!conn) return
        for (const topic of conn.subs.values()) leave(conn, topic)
        connections.delete(id)
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
    const conn = id ? connections.get(id) : undefined
    if (!conn) return new Response('Unknown connection', { status: 410 })
    const msg = (await readBody(event)) as ClientMessage
    if (!msg || typeof msg !== 'object') return new Response(null, { status: 400 })
    if (msg.t === 'ping') return new Response(null, { status: 204 })
    if (msg.t === 'unsub') {
      const topic = conn.subs.get(msg.id)
      if (topic) {
        conn.subs.delete(msg.id)
        leave(conn, topic)
      }
      return new Response(null, { status: 204 })
    }
    const channel = channels.get(msg.ch)
    const msgId = 'id' in msg ? msg.id : undefined
    if (!channel) {
      fail(conn, KitrError.notFound(`Channel "${msg.ch}"`), msgId)
      return new Response(null, { status: 204 })
    }
    let params = msg.p
    if (channel.params) {
      const result = await validate(channel.params, msg.p)
      if (!result.success) {
        fail(conn, KitrError.validation(result.fieldErrors), msgId)
        return new Response(null, { status: 204 })
      }
      params = result.data
    }
    try {
      if (channel.authorize && !(await channel.authorize(params, conn.ctx)))
        throw KitrError.forbidden(`Not allowed on channel "${msg.ch}"`)
      if (msg.t === 'sub') {
        const topic = topicFor(channel.name, params)
        conn.subs.set(msg.id, topic)
        let set = topics.get(topic)
        if (!set) {
          set = new Set()
          topics.set(topic, set)
        }
        set.add(conn)
        send(conn, { t: 'ok', id: msg.id })
      } else if (msg.t === 'msg') {
        await channel.onMessage?.(msg.ev, msg.d, params, conn.ctx)
      }
    } catch (error) {
      fail(conn, error, msgId)
    }
    return new Response(null, { status: 204 })
  }

  const handler = defineHandler((event) =>
    event.req.method === 'POST' ? control(event) : stream(event),
  )

  const sse: SseServer = {
    handler,
    get connections() {
      return connections.size
    },
    use(channel, params) {
      const topic = topicFor(channel.name, params)
      return {
        get size() {
          return topics.get(topic)?.size ?? 0
        },
        emit(event, data) {
          const payload = frame(
            JSON.stringify({
              t: 'ev',
              ch: channel.name,
              p: params ?? null,
              ev: event,
              d: data,
            } satisfies ServerMessage),
          )
          for (const conn of topics.get(topic) ?? []) conn.write(payload)
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

/** A provider that binds an SSE server as `realtime` in the container. It does not attach the route. */
export function sseProvider(options: SseServerOptions): KitrProvider {
  return defineProvider({
    name: 'realtime',
    register(app) {
      app.container.singleton('realtime', () => createSseServer(options) as any)
    },
  })
}
