import { KitrError, toKitrError, validate } from '@kitr/core'
import type { ChannelDefinition, ChannelParams, ClientMessage, ServerMessage } from '@kitr/socket'
import { topicFor } from '@kitr/socket'
import type { Server, Socket } from 'socket.io'

export interface SocketIoServerOptions {
  channels: ChannelDefinition<any, any>[]
  /** Authenticate a connection (`socket.handshake.auth`). Return context or throw. */
  authorize?: (socket: Socket) => unknown | Promise<unknown>
  namespace?: string
}

export interface SocketIoServer {
  io: Server
  use<C extends ChannelDefinition<any, any>>(
    channel: C,
    params: ChannelParams<C>,
  ): { emit(event: keyof C['events'] & string, data: unknown): void }
}

/**
 * Serve kitr channels over a Socket.IO server. Rooms are channel topics, so the
 * Redis adapter and sticky sessions work as they do for any Socket.IO app.
 *
 *   const io = new Server(nodeServer)
 *   const sockets = attachSocketIo(io, { channels: [projectChannel] })
 *   sockets.use(projectChannel, { id }).emit('updated', project)
 */
export function attachSocketIo(io: Server, options: SocketIoServerOptions): SocketIoServer {
  const nsp = options.namespace ? io.of(options.namespace) : io
  const channels = new Map(options.channels.map((c) => [c.name, c]))

  nsp.use(async (socket, next) => {
    try {
      socket.data.kitrCtx = (await options.authorize?.(socket)) ?? {}
      next()
    } catch (error) {
      next(toKitrError(error))
    }
  })

  nsp.on('connection', (socket) => {
    const subs = new Map<string, string>()
    const send = (msg: ServerMessage) => socket.emit('kitr', msg)
    const fail = (error: unknown, id?: string) =>
      send({ t: 'err', id, e: toKitrError(error).toJSON() })
    socket.on('kitr', async (msg: ClientMessage) => {
      if (!msg || typeof msg !== 'object') return
      if (msg.t === 'ping') return send({ t: 'pong' })
      if (msg.t === 'unsub') {
        const topic = subs.get(msg.id)
        if (topic) {
          subs.delete(msg.id)
          socket.leave(topic)
        }
        return
      }
      const channel = channels.get(msg.ch)
      const id = 'id' in msg ? msg.id : undefined
      if (!channel) return fail(KitrError.notFound(`Channel "${msg.ch}"`), id)
      let params = msg.p
      if (channel.params) {
        const result = await validate(channel.params, msg.p)
        if (!result.success) return fail(KitrError.validation(result.fieldErrors), id)
        params = result.data
      }
      try {
        if (channel.authorize && !(await channel.authorize(params, socket.data.kitrCtx)))
          throw KitrError.forbidden()
        if (msg.t === 'sub') {
          const topic = topicFor(channel.name, params)
          const previous = subs.get(msg.id)
          if (previous && previous !== topic) socket.leave(previous)
          subs.set(msg.id, topic)
          await socket.join(topic)
          send({ t: 'ok', id: msg.id, p: params ?? null })
        } else if (msg.t === 'msg') {
          await channel.onMessage?.(msg.ev, msg.d, params, socket.data.kitrCtx)
        }
      } catch (error) {
        fail(error, id)
      }
    })
  })

  return {
    io,
    use(channel, params) {
      const topic = topicFor(channel.name, params)
      return {
        emit(event, data) {
          nsp.to(topic).emit('kitr', {
            t: 'ev',
            ch: channel.name,
            p: params ?? null,
            ev: event,
            d: data,
          } satisfies ServerMessage)
        },
      }
    },
  }
}
