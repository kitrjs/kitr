import {
  type AnyRouteTable,
  defineRouteExtension,
  type ExtensionKey,
  type KitrRouter,
  type RouteEntry,
} from '@kitr/core'
import type { KitrServer } from '@kitr/server'
import type { ChannelDefinition } from './protocol'
import {
  createSocketServer,
  type RealtimeServer,
  type SocketServer,
  type SocketServerOptions,
} from './server'
import { createSseServer, type SseServer, type SseServerOptions } from './sse-server'

/** The type carried per socket route into `$types`. */
export interface SocketRouteType<
  Transport extends 'websocket' | 'sse' = 'websocket' | 'sse',
  Path extends string = string,
  C extends ChannelDefinition<any, any> = ChannelDefinition<any, any>,
> {
  kind: 'ws'
  transport: Transport
  path: Path
  /** The union of channel definitions served on this path. */
  channels: C
}

/** Options for `.ws(path, options)`: the channels and the upgrade authorizer. */
export interface WsRouteOptions<C extends readonly ChannelDefinition<any, any>[]>
  extends Omit<SocketServerOptions, 'channels'> {
  channels: C
}

/** Options for `.sse(path, options)`: the channels, the stream authorizer and the keep-alive. */
export interface SseRouteOptions<C extends readonly ChannelDefinition<any, any>[]>
  extends Omit<SseServerOptions, 'channels'> {
  channels: C
}

declare module '@kitr/core' {
  interface RouterExtensions<K extends string, R extends Record<string, unknown>> {
    /**
     * `@kitr/realtime/routes`: realtime endpoints. `.ws` serves channels over a WebSocket
     * upgrade (crossws), `.sse` over server-sent events plus a POST control channel. Both
     * bind the first server as `realtime` in the container, so a controller can
     * `realtime.use(channel, params).emit(event, data)`.
     *
     *   r.group('/api', (api) => api.ws('/ws', { channels: [chatChannel], authorize: (req) => verify(req) }))
     */
    ws: {
      ws<Path extends string, const C extends readonly ChannelDefinition<any, any>[]>(
        path: Path,
        options: WsRouteOptions<C>,
      ): KitrRouter<
        K & ExtensionKey,
        R & { [N in `WS ${Path}`]: SocketRouteType<'websocket', Path, C[number]> }
      >
      sse<Path extends string, const C extends readonly ChannelDefinition<any, any>[]>(
        path: Path,
        options: SseRouteOptions<C>,
      ): KitrRouter<
        K & ExtensionKey,
        R & { [N in `SSE ${Path}`]: SocketRouteType<'sse', Path, C[number]> }
      >
    }
  }
}

interface SocketEntry extends RouteEntry {
  kind: 'ws'
  transport: 'websocket' | 'sse'
  options: SocketServerOptions | SseServerOptions
}

function joinPath(base: string, path: string): string {
  const joined = `${base}/${path}`.replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return joined === '' ? '/' : joined.startsWith('/') ? joined : `/${joined}`
}

function addSocket(
  table: AnyRouteTable,
  transport: 'websocket' | 'sse',
  path: string,
  options: SocketServerOptions | SseServerOptions,
) {
  const fullPath = joinPath(table.prefix, path)
  table.add({
    kind: 'ws',
    transport,
    path: fullPath,
    name: `${transport === 'sse' ? 'SSE' : 'WS'} ${fullPath}`,
    options,
    channels: options.channels.map((c) => c.name),
  })
}

/** What the `h3` target returns: the realtime servers by path. */
export type MountedSockets = Record<string, SocketServer | SseServer>

/**
 * The realtime extension: `.ws` and `.sse` on the route table, mounted by
 * `createServer({ routes })`. No React: safe in a pure backend.
 *
 *   import { defineRoutes } from '@kitr/kitr/app'
 *   import ws from '@kitr/realtime/routes'
 *   export const routes = defineRoutes([ws], (r) => r.ws('/ws', { channels: [chatChannel] }))
 */
const ws = defineRouteExtension({
  key: 'ws',
  kinds: ['ws'],
  methods: {
    ws(this: AnyRouteTable, path: string, options: SocketServerOptions) {
      addSocket(this, 'websocket', path, options)
      return this
    },
    sse(this: AnyRouteTable, path: string, options: SseServerOptions) {
      addSocket(this, 'sse', path, options)
      return this
    },
  },
  targets: {
    h3(entries: RouteEntry[], server: KitrServer): MountedSockets {
      const mounted: MountedSockets = {}
      for (const entry of entries as SocketEntry[]) {
        const realtime =
          entry.transport === 'sse'
            ? createSseServer(entry.options as SseServerOptions)
            : createSocketServer(entry.options as SocketServerOptions)
        realtime.attach(server, entry.path)
        mounted[entry.path] = realtime
        // The first realtime server is what controllers and jobs emit through, behind the
        // transport-neutral `RealtimeServer` shape the container binding declares.
        if (!server.app.container.has('realtime')) {
          const bound: RealtimeServer = {
            transport: entry.transport,
            use: (channel, params) => realtime.use(channel, params),
            attach(target, path) {
              realtime.attach(target, path ?? entry.path)
              return bound
            },
            get connections() {
              return realtime.connections
            },
            closeSessions: (userId) => realtime.closeSessions(userId),
          }
          server.app.container.value('realtime', bound)
        }
      }
      return mounted
    },
  },
})

export default ws
export { ws }
