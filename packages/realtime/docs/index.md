---
title: Realtime
description: Define a live channel once and push updates to every open screen, over WebSockets, Socket.IO or server events.
order: 1
---

# Realtime

A chat, a notification bell, a project board that updates while you look at it: all of them need the server to push to screens that are already open. `@kitr/realtime` lets you define a typed **channel** once, emit events on it from the server, and have every subscribed screen update its query cache.

> [!SUMMARY]
> Define a live channel once and push updates to every open screen, over WebSockets, Socket.IO or server events. Add it with `kitr add realtime`; the overview is at [/packages/realtime](/packages/realtime).

It runs over [crossws](https://crossws.unjs.io) WebSockets by default, or [Socket.IO](https://socket.io/docs/v4/) or Server-Sent Events, and the channel code is the same on all three. The server half (`@kitr/realtime/server`) emits; the client half (`@kitr/realtime`, `@kitr/realtime/react`) subscribes. For one-off server calls that return a value, use [actions](/packages/actions) or [api](/packages/api). The examples follow Acme's project board at `app.acme.com`.

## Install

```sh
kitr add realtime
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Adds the [server](/packages/server) package first if the project does not have it yet.
- Installs `@kitr/realtime`, `crossws` and `partysocket`, the reconnecting WebSocket client that `@kitr/realtime` imports.
- Adds `'@kitr/realtime'` to `packages` in `kitrrc.ts`. Realtime registers no provider.
- Writes `config/realtime.ts` (shown under Configure).
- Writes `app/channels/example.ts`, a sample channel named `example` with one `message` event.
- Adds `realtime` from `@kitr/realtime/routes` to the extension list of the server route table (`server/routes.ts`, created with an empty table when missing) and appends `.ws('<path>', { channels: [exampleChannel] })` to it, with the path from `config/realtime.ts`. The table is what `createServer({ routes })` in `server/main.ts` serves; a `server/main.ts` written before the table existed gets the `routes` option added.
- In a React app, writes `app/realtime.ts`, which opens one client connection per tab on first use.
- Regenerates `config/index.ts`, the config list the standalone server imports.
- Adds a `## kitr: realtime` section to `AGENTS.md` that says where channels live, how the server emits and how components subscribe, and how to switch transports.

A project without React (a pure backend) gets the `/ws` path and no client files. The `fullstack`, `server` and `realtime` kits already include it.

`kitr remove realtime` removes the package entry, the `AGENTS.md` section, `config/realtime.ts` and the realtime dependencies, and takes `realtime` out of the route table's extension list. It leaves `app/channels/` and `app/realtime.ts` in place, and tells you to delete any `.ws()` or `.sse()` links.

</details>

To preview the changes:

```sh
kitr add realtime --dry-run
```

## Configure

In a React app, `kitr add realtime` writes this file:

```ts
// config/realtime.ts
import { defineConfig } from '@kitr/realtime'

export default defineConfig({
  // websocket (default), socket.io or sse: the channels and hooks stay the same.
  transport: 'websocket',
  path: '/api/ws',
})
```

In a project without React, the path is `'/ws'` instead of `'/api/ws'`.

> [!WARNING] Keep path and link in step
> The client reads this file; the server does not. The `.ws(path, ...)` link in `server/routes.ts` carries its own path, so change both together.

| Option | Default | Description |
| --- | --- | --- |
| `transport` | `'websocket'` | `'websocket'` (crossws and partysocket), `'socket.io'` (rooms, adapters) or `'sse'` (one-way stream over HTTP, control messages over POST). |
| `path` | `'/ws'`, or `'/events'` for `sse` | Where the server listens. The client connects to the same origin at this path. |
| `url` | same origin at `path` | A full URL for the client, such as `wss://realtime.acme.com/ws`, when the realtime server is on another host. |
| `heartbeat` | `25000` | WebSocket only: milliseconds between pings. A missed ping reconnects. `0` turns pings off. |

## Push your first update

Three files make a live project name: a channel both ends import, an emit on the server, and a subscription in a component.

Define the channel. The examples use `zod` (`pnpm add zod`); any [Standard Schema](https://standardschema.dev) library works.

```ts
// app/channels/projects.ts
import { defineChannel } from '@kitr/realtime'
import { z } from 'zod'

export const projectSchema = z.object({ id: z.string(), name: z.string(), teamId: z.string() })
export type Project = z.infer<typeof projectSchema>

export const projectChannel = defineChannel({
  name: 'projects',
  params: z.object({ id: z.string() }),
  events: {
    updated: {
      schema: projectSchema,
      effects: (project, { id }) => ({ set: [{ key: ['projects', 'detail', id], data: project }] }),
    },
  },
})
```

Serve the channel from the server route table, then emit from the controller that renames a project:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import realtime from '@kitr/realtime/routes'
import { projectChannel } from '#app/channels/projects'
import ProjectsController from '#server/controllers/projects-controller'

export const routes = defineRoutes([api, realtime], (root) =>
  root.group('/api', (r) =>
    r.resource('projects', ProjectsController).ws('/ws', { channels: [projectChannel] }),
  ),
)

export type ServerRoutes = typeof routes.$types
```

`.ws(path, options)` is a route like any other: it mounts the WebSocket server at `/api/ws` and binds it in the container as `realtime`, so controllers, actions and jobs reach it through `app.container.use('realtime')`:

```ts
// server/controllers/projects-controller.ts
import type { HttpContext } from '@kitr/api'
import { type Project, projectChannel } from '#app/channels/projects'

export default class ProjectsController {
  async update({ app, params, body }: HttpContext<{ id: string }, Record<string, string>, { name: string }>) {
    const project: Project = { id: params.id, name: body.name, teamId: 'team_acme' }
    // ... save it with your database
    app.container.use('realtime').use(projectChannel, { id: params.id }).emit('updated', project)
    return project
  }
}
```

Subscribe in the component that shows the project:

```tsx
// app/components/projects/project-title.tsx
import { useQuery } from '@kitr/query'
import { useChannel } from '@kitr/realtime/react'
import { type Project, projectChannel } from '#app/channels/projects'
import { realtime } from '#app/realtime'

export function ProjectTitle({ id }: { id: string }) {
  useChannel(realtime(), projectChannel, { id })
  const { data } = useQuery<Project>({ queryKey: ['projects', 'detail', id], enabled: false })
  return <h1>{data?.name ?? 'Loading'}</h1>
}
```

When a project is saved, the server sends one `updated` event to every connection subscribed with that id. Each client validates the payload and runs `effects`, which writes the project into the `['projects', 'detail', id]` cache entry. Headings re-render with the new name, with no refetch.

## Define a channel

A channel is a name, the params a subscriber picks, and the events the server sends. One file under `app/channels/` is imported by both ends, so names and payload types cannot drift.

```ts
// app/channels/projects.ts
import { defineChannel } from '@kitr/realtime'
import { z } from 'zod'

export const projectSchema = z.object({ id: z.string(), name: z.string(), teamId: z.string() })

export const projectChannel = defineChannel({
  name: 'projects',
  params: z.object({ id: z.string().trim() }),
  events: {
    updated: { schema: projectSchema },
    deleted: {},
    typing: { schema: z.object({ user: z.string() }) },
  },
})
```

| Field | Runs on | Description |
| --- | --- | --- |
| `name` | both | Unique channel name. Two channels with the same name collide. |
| `params` | server | Schema for what a client subscribes with. Invalid params fail with `VALIDATION`. |
| `events` | both | Event names, each with an optional `schema` and `effects`. |
| `authorize(params, ctx)` | server | Return `false` to refuse a subscription. See [Authorize a subscription](#authorize-a-subscription). |
| `onMessage(event, data, params, ctx)` | server | Receives events a client sends up the channel. |

`kitr make:channel <name>` writes a starting file. Without a `params` schema, give the params type as a type argument: `defineChannel<{ room: string }>({ ... })`.

## Validate params and payloads

On the server, `params` runs first, and its output is what the subscription is filed under, so a schema that trims merges `' prj_1 '` and `'prj_1'` into one topic. On the client, an event with a `schema` is validated before `effects` runs; a payload that fails is not applied and the error handler gets a `VALIDATION` error:

```ts
// app/lib/projects/project-errors.ts
import { channel } from '@kitr/realtime'
import { projectChannel } from '#app/channels/projects'
import { realtime } from '#app/realtime'

channel(realtime(), projectChannel)
  .subscription()
  .subscribe(
    { id: 'prj_1' },
    {
      next: (event) => console.log(event.event, event.data),
      error: (error) => console.warn(error),
      // => { code: 'VALIDATION', message: 'Invalid payload for projects.updated', status: 422, fieldErrors: { name: [...] } }
    },
  )
```

Events the channel does not declare are dropped on the client without an error.

> [!WARNING] Emit is not validated
> The server does not validate what you pass to `emit`; schemas only protect clients. Emit data you built from your own records.

## Update the cache from events

`effects(data, params)` returns the same cache effect a [query](/packages/query) mutation returns: `set` writes an entry, `invalidate` marks entries stale so mounted queries refetch, `remove` drops them.

```ts
// app/channels/projects.ts
import { defineChannel } from '@kitr/realtime'
import { z } from 'zod'

const projectSchema = z.object({ id: z.string(), name: z.string(), teamId: z.string() })

export const projectChannel = defineChannel({
  name: 'projects',
  params: z.object({ id: z.string() }),
  events: {
    // Write the new value: no request.
    updated: {
      schema: projectSchema,
      effects: (project, { id }) => ({
        set: [{ key: ['projects', 'detail', id], data: project }],
        invalidate: [['projects', 'list']],
      }),
    },
    // Drop the detail and refetch every list.
    deleted: {
      effects: (_data, { id }) => ({
        remove: [['projects', 'detail', id]],
        invalidate: [['projects', 'list']],
      }),
    },
  },
})
```

Use `set` when the event carries the full record. Use `invalidate` when it only says something changed; the query refetches through its normal `fetch`, so permission checks stay on the server. Declare cache writes in `effects`, not with `setQueryData` in a component.

## Emit from the server

`realtime.use(channel, params)` returns an emitter for one topic. Read the server from the container: `ctx.app` in a controller, `useRequestApp()` in an action, or the server's app in a job:

```ts
// app/actions/projects/rename.ts
import { defineMutation } from '@kitr/actions'
import { useRequestApp } from '@kitr/server'
import { z } from 'zod'
import { projectChannel } from '#app/channels/projects'

export const renameProject = defineMutation('projects.rename', {
  input: z.object({ id: z.string(), name: z.string().min(2) }),
  handler: async ({ input }) => {
    const project = { id: input.id, name: input.name, teamId: 'team_acme' }
    // ... save it with your database
    useRequestApp().container.use('realtime').use(projectChannel, { id: input.id }).emit('updated', project)
    return project
  },
})
```

The emitter also reports how many connections are listening, to skip work nobody will see:

```ts
// server/jobs/project-stats.ts
import { projectChannel } from '#app/channels/projects'
import { server } from '#server/main'

const realtime = server.app.container.use('realtime')
const topic = realtime.use(projectChannel, { id: 'prj_1' })
console.log(topic.size)
// => 2 (Ada and Linus have the board open)
console.log(realtime.connections)
// => 3 (open WebSocket connections, subscribed or not)
```

Emit with the params as the server normalised them: with `z.string().trim()`, `{ id: 'prj_1' }` reaches a client that subscribed with `' prj_1 '`, but `{ id: ' prj_1 ' }` reaches nobody. Key order does not matter.

## Subscribe in a component

`useChannel(transport, channel, params, options?)` from `@kitr/realtime/react` subscribes on mount, applies each event's `effects` to the query cache, and unsubscribes on unmount. It needs the [query](/packages/query) provider, which every kit with React includes.

```tsx
// app/components/projects/project-board.tsx
import { useChannel } from '@kitr/realtime/react'
import { projectChannel } from '#app/channels/projects'
import { realtime } from '#app/realtime'

export function ProjectBoard({ id }: { id: string }) {
  const live = useChannel(realtime(), projectChannel, { id }, {
    onEvent: (event) => {
      if (event.event === 'deleted') window.location.assign('/projects')
    },
    onError: (error) => console.warn(error.code, error.message),
  })
  return <p>{live.status === 'open' ? 'Live' : live.status}</p>
}
```

`useChannel` returns `{ status, lastEvent, error }`:

| Field | Description |
| --- | --- |
| `status` | `'idle'` before subscribing or with `enabled: false`, `'open'` once subscribed, `'error'` after an error. |
| `lastEvent` | The last `{ event, data }` received, typed as a union of the channel's events. |
| `error` | The last error, a `KitrErrorShape` such as `{ code: 'FORBIDDEN', ... }`. |

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | `false` skips the subscription, for example until a project id is known. |
| `onEvent(event)` | none | Runs for every valid event, after `effects`. |
| `onError(error)` | none | Runs for subscription errors: params, authorization, payload validation. |

Changing `params` resubscribes.

> [!WARNING] Browser only
> `app/realtime.ts` opens the connection the first time `realtime()` runs, so render subscribing components in the browser only: a route with `ssrRoute(false)` from [seo](/packages/seo), or a component that mounts after hydration.

## Subscribe with useSubscription

`channel(transport, definition)` binds a channel to a transport. Its `subscription()` is a subscription contract that `useSubscription` and `subscriptionFrom` from [query](/packages/query) take directly:

```ts
// app/queries/projects.ts
import { subscriptionFrom } from '@kitr/query'
import { channel } from '@kitr/realtime'
import { projectChannel } from '#app/channels/projects'
import { realtime } from '#app/realtime'

/** Call inside a component, so the socket opens in the browser. */
export const projectSubscription = () =>
  subscriptionFrom(channel(realtime(), projectChannel).subscription())
```

```tsx
// app/components/projects/project-live.tsx
import { useSubscription } from '@kitr/query'
import { useMemo } from 'react'
import { projectSubscription } from '#app/queries/projects'

export function ProjectLive({ id }: { id: string }) {
  const subscription = useMemo(() => projectSubscription(), [])
  const live = useSubscription(subscription, { id })
  return <span>{live.status}</span>
}
```


## Show the connection status

`useChannel` reports the subscription. To show whether the socket itself is connected, use `useRealtimeStatus(transport)`:

```tsx
// app/components/connection-badge.tsx
import { useRealtimeStatus } from '@kitr/realtime/react'
import { realtime } from '#app/realtime'

export function ConnectionBadge() {
  const status = useRealtimeStatus(realtime())
  // => 'connecting' | 'open' | 'closed'
  return <span>{status === 'open' ? 'Online' : 'Reconnecting'}</span>
}
```

The WebSocket client reconnects with backoff and resubscribes.

> [!WARNING] No replay
> Events emitted while a client was offline are not replayed. On reconnect, invalidate what matters, or let `refetchOnWindowFocus` catch up.

## Send events from the client

`channel(...).send(params, event, data)` sends an event up a channel. The server runs the channel's `params` schema and `authorize`, then calls its `onMessage`. Here, typing in a comment box tells everyone else on the board. Declare the event so clients can receive it:

```ts
// app/channels/projects.ts
import { defineChannel } from '@kitr/realtime'
import { z } from 'zod'

export const projectChannel = defineChannel({
  name: 'projects',
  params: z.object({ id: z.string() }),
  events: {
    typing: { schema: z.object({ user: z.string() }) },
  },
})
```

The server adds `onMessage` to its copy of the channel (channels match by `name`), so the handler never reaches the browser:

```ts
// server/routes.ts
r.ws('/ws', {
  channels: [
    {
      ...projectChannel,
      onMessage: (event, data, params, _ctx, realtime) => {
        if (event !== 'typing' || typeof (data as { user?: unknown })?.user !== 'string') return
        realtime.use(projectChannel, params).emit('typing', data as { user: string })
      },
    },
  ],
})
```

```tsx
// app/components/projects/comment-box.tsx
import { channel } from '@kitr/realtime'
import { projectChannel } from '#app/channels/projects'
import { realtime } from '#app/realtime'

export function CommentBox({ projectId }: { projectId: string }) {
  const project = channel(realtime(), projectChannel)
  return <textarea onKeyDown={() => project.send({ id: projectId }, 'typing', { user: 'Ada' })} />
}
```

`onMessage(event, data, params, ctx, realtime)` receives the validated params, the connection's context and the server, to emit back. Check `data` yourself: event schemas are checked at the client, not the server.

> [!WARNING] Not for changes
> `send` has no reply and no retry. For anything that changes data, call an action or an API route.

## Authenticate connections

`authorize(request)` runs once, when a connection opens. Return the connection's context, such as the signed-in user. Return `false` to refuse with `401`, or throw a `KitrError` to refuse with its status.

```ts
// server/routes.ts
import { KitrError } from '@kitr/kitr/app'
import { projectChannel } from '#app/channels/projects'
import { userFromSession } from '#server/auth'

r.ws('/ws', {
  channels: [projectChannel],
  authorize: async (request) => {
    const cookie = request.headers.get('cookie') ?? ''
    const session = cookie.match(/(?:^|;\s*)acme_session=([^;]+)/)?.[1]
    const user = session ? await userFromSession(session) : null
    if (!user) throw KitrError.unauthorized()
    return { user }
  },
})
```

`userFromSession` stands for your own lookup. Browsers send cookies with the same-site WebSocket upgrade, so a session cookie needs no client code. For a token, put it in the URL and read it with `new URL(request.url).searchParams.get('token')`:

```ts
// app/realtime.ts
import { createSocketClient, type SocketTransport } from '@kitr/realtime'
import realtimeConfig from '#config/realtime'

let transport: SocketTransport | undefined

export function realtime(): SocketTransport {
  transport ??= createSocketClient({
    url: async () => {
      const token = localStorage.getItem('acme_token') ?? ''
      return `${window.location.origin.replace(/^http/, 'ws')}${realtimeConfig.path}?token=${token}`
    },
  })
  return transport
}
```

The `url` function runs again on every reconnect, so a refreshed token is picked up.

## Close a revoked session

Nothing re-checks an open connection, so a user who signs out everywhere or is banned keeps receiving the topics they already joined until their socket drops. `closeSessions(userId)` closes every connection of the user on this instance and returns how many:

```ts
// server/revoke.ts
import { realtime } from '#server/realtime'

export function revokeLiveAccess(userId: string) {
  return realtime.closeSessions(userId)
}
```

A WebSocket closes with code `4401`; the client reconnects and `authorize(request)` refuses the revoked session. Connections belong to a user by the context `authorize` returned (`userId`, `user.id` or `id`); if yours is shaped differently, say how with `identify`:

```ts
// server/routes.ts
r.ws('/ws', {
  channels: [projectChannel],
  authorize: async (request) => ({ account: await accountFromSession(request) }),
  identify: (ctx) => (ctx as { account: { id: string } }).account.id,
})
```

The session controller from [@kitr/auth](/packages/auth) calls a hook after it revokes every session of a user, so one line connects the two:

```ts
// server/controllers/auth_controller.ts
import { createSessionController } from '@kitr/auth/server'
import { realtime } from '#server/realtime'
import { sessions, users } from '#server/auth'

export default createSessionController({
  sessions,
  users,
  onSessionsRevoked: (userId) => realtime.closeSessions(userId),
})
```

> [!WARNING] One instance only
> `closeSessions` reaches only the instance that runs it. With several instances, call it where every instance hears about the revocation, such as a Redis pub/sub handler. Call it yourself wherever you end access outside the session controller.

## Authorize a subscription

`authorize(params, ctx)` on the channel decides who may subscribe to which topic. `ctx` is what the server's `authorize(request)` returned. It also guards `send`.

```ts
// app/channels/projects.ts
import { defineChannel } from '@kitr/realtime'
import { z } from 'zod'

type Ctx = { user: { id: string; teamIds: string[] } }

export const projectChannel = defineChannel({
  name: 'projects',
  params: z.object({ id: z.string(), teamId: z.string() }),
  events: { updated: {} },
  authorize: ({ teamId }, ctx) => (ctx as Ctx).user.teamIds.includes(teamId),
})
```

A user outside the team gets `error: { code: 'FORBIDDEN', ... status: 403 }` from `useChannel` and receives no events. A channel without `authorize` lets every authenticated connection subscribe.

## Handle errors

Subscription errors (bad params, `FORBIDDEN`, an unknown channel) go to that subscription's `onError`; errors with no subscription go to the transport's `onError`:

```ts
// app/realtime.ts
import { createSocketClient, type SocketTransport } from '@kitr/realtime'
import realtimeConfig from '#config/realtime'

let transport: SocketTransport | undefined

export function realtime(): SocketTransport {
  transport ??= createSocketClient({
    url: () => `${window.location.origin.replace(/^http/, 'ws')}${realtimeConfig.path}`,
    reconnect: { maxRetries: 20, minReconnectionDelay: 1_000, maxReconnectionDelay: 30_000 },
    onError: (error) => console.warn('[realtime]', error.code, error.message),
  })
  return transport
}
```

This is the file `kitr add` writes, with `createSocketClient` called directly so you can pass its options:

| Option | Default | Description |
| --- | --- | --- |
| `url` | required | `ws://` or `wss://` URL, or a function returning one (sync or async). |
| `protocols` | none | WebSocket subprotocols. |
| `reconnect.maxRetries` | partysocket's default | Give up after this many attempts. |
| `reconnect.minReconnectionDelay` | partysocket's default | First retry delay in milliseconds. |
| `reconnect.maxReconnectionDelay` | partysocket's default | Longest retry delay in milliseconds. |
| `onError(error)` | none | Server errors not tied to a subscription. |

See [partysocket](https://docs.partykit.io/reference/partysocket-api/) for the reconnect defaults.

## Connect from another origin

When the realtime server runs on its own host, set `url` in config:

```ts
// config/realtime.ts
import { defineConfig } from '@kitr/realtime'

export default defineConfig({
  transport: 'websocket',
  path: '/ws',
  url: 'wss://realtime.acme.com/ws',
})
```

From a Node script or a test, call `createSocketClient` with a full URL (Node 22 and later ship a global `WebSocket`):

```ts
// scripts/watch_project.ts
import { channel, createSocketClient } from '@kitr/realtime'
import { projectChannel } from '#app/channels/projects'

const transport = createSocketClient({ url: 'ws://localhost:3001/ws' })
channel(transport, projectChannel)
  .subscription()
  .subscribe({ id: 'prj_1' }, { next: (event) => console.log(event) })
// => { event: 'updated', data: { id: 'prj_1', name: 'Apollo launch', teamId: 'team_acme' } }
```

## The server in the container

The first `.ws()` or `.sse()` link is available as `realtime` in the container. To run a server outside the route table, use `createRealtimeServer(options)` from `@kitr/realtime/server` and call `attach(server, path)` before `server.listen()`.

## Transports

All three transports share one client interface, so channels, `effects`, `useChannel` and `emit` are identical. Only the server link (`.ws`, `.sse` or an attached Socket.IO server) and the client the app creates change.

| `transport` | Client | Server | Use it when |
| --- | --- | --- | --- |
| `websocket` | `createSocketClient` (partysocket) | `createRealtimeServer`, which uses `createSocketServer` (crossws via h3) | The default. Two-way, low latency, runs on Node, Bun, Deno and Cloudflare. |
| `socket.io` | `createSocketIoClient` | `attachSocketIo` | You already run Socket.IO or need its rooms and adapters. |
| `sse` | `createSseTransport` (EventSource plus POST) | `createRealtimeServer`, which uses `createSseServer` | Your host or proxy does not allow WebSocket upgrades. |

### WebSocket

The default, set up by `kitr add realtime`: `crossws` on the server, `partysocket` in the browser.

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import realtime from '@kitr/realtime/routes'
import { projectChannel } from '#app/channels/projects'
import realtimeConfig from '../config/realtime'

export const routes = defineRoutes([realtime], (r) =>
  // WebSocket upgrades on /api/ws, next to the routes.
  r.ws('/api/ws', { channels: [projectChannel] }),
)
```

```ts
// server/main.ts
import { createServer } from '@kitr/server'
import { routes } from './routes'
import { config } from '../config'
import rc from '../kitrrc'

export const server = createServer({ providers: rc.providers, config, routes })
```

`.ws(path, options)` takes `channels`, `authorize`, `adapter` and the other `createRealtimeServer` options. Without `crossws` installed, `listen()` throws and tells you to run `kitr add socket`. See the [crossws docs](https://crossws.unjs.io) for runtime adapters.

### Socket.IO

<details>
<summary>Set up Socket.IO</summary>

Install both halves:

```sh
pnpm add socket.io socket.io-client
```

Set the transport and path in config:

```ts
// config/realtime.ts
import { defineConfig } from '@kitr/realtime'

export default defineConfig({
  transport: 'socket.io',
  path: '/api/socket.io',
})
```

On the server, create a Socket.IO server and serve your channels on it with `attachSocketIo`. Its `authorize` receives the socket and reads `socket.handshake.auth`:

```ts
// server/realtime.ts
import { KitrError } from '@kitr/kitr/app'
import { attachSocketIo } from '@kitr/realtime/socket.io/server'
import { Server } from 'socket.io'
import { projectChannel } from '#app/channels/projects'
import { userFromToken } from '#server/auth'

export const io = new Server({ path: '/api/socket.io' })

export const realtime = attachSocketIo(io, {
  channels: [projectChannel],
  authorize: async (socket) => {
    const user = await userFromToken(String(socket.handshake.auth.token ?? ''))
    if (!user) throw KitrError.unauthorized()
    return { user }
  },
})
```

Bind it to the HTTP server once the kitr server is listening:

```ts
// server/main.ts
import type { Server as HttpServer } from 'node:http'
import { createServer } from '@kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { io } from './realtime'
import { routes } from './routes'

export const server = createServer({ providers: rc.providers, config, routes })
const listening = await server.listen({ port: 3001 })
io.attach(listening.node as HttpServer)
```

In the browser, create the client from `@kitr/realtime/socket.io`, which also exports `channel` and `defineChannel`:

```ts
// app/realtime.ts
import type { SocketTransport } from '@kitr/realtime'
import { createSocketIoClient } from '@kitr/realtime/socket.io'
import realtimeConfig from '#config/realtime'

let transport: SocketTransport | undefined

export function realtime(): SocketTransport {
  transport ??= createSocketIoClient({
    path: realtimeConfig.path,
    auth: { token: localStorage.getItem('acme_token') ?? '' },
  })
  return transport
}
```

`createSocketIoClient` takes every [socket.io-client option](https://socket.io/docs/v4/client-options/) plus `url` and `onError`, and exposes the raw socket as `.socket`. Each channel topic is a Socket.IO room. Pass `namespace: '/board'` to `attachSocketIo` to serve channels on a namespace. The Socket.IO emitter has no `size`.

</details>

### Server-Sent Events

SSE needs no extra packages. The server streams events over one long `GET`; the client sends with `POST`s to the same path. Set the transport in config:

```ts
// config/realtime.ts
import { defineConfig } from '@kitr/realtime'

export default defineConfig({
  transport: 'sse',
  path: '/api/events',
})
```

```ts
// server/routes.ts
r.sse('/api/events', { channels: [projectChannel], keepAlive: 15_000 })
```

`.sse(path, options)` mounts the stream and its control endpoint on one path. The `app/realtime.ts` that `kitr add` wrote already works; to pass headers on the control `POST`s, create the transport yourself:

```ts
// app/realtime.ts
import { createSseTransport, type SocketTransport } from '@kitr/realtime'

let transport: SocketTransport | undefined

export function realtime(): SocketTransport {
  transport ??= createSseTransport({
    url: '/api/events',
    headers: () => ({ 'x-acme-team': 'team_acme' }),
  })
  return transport
}
```

| Option | Default | Description |
| --- | --- | --- |
| `keepAlive` (server) | `20000` | Milliseconds between keep-alive comments, so proxies don't close an idle stream. |
| `authorize(request)` (server) | none | Runs when the stream opens. Same rules as the WebSocket server. |
| `url` (client) | required | The stream URL. Control messages are POSTed to it. |
| `headers` (client) | none | Headers for the control `POST`s, or a function returning them. |
| `onError` (client) | none | Errors without a subscription, and failed `POST`s as `NETWORK`. |

`EventSource` cannot set headers, so the stream authenticates by cookie or by a `?token=` in the URL. See [MDN on Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

## Run more than one server instance

Each instance keeps its own connections. To make an `emit` on one instance reach clients on another, give the realtime server an **adapter**, the shared bus instances publish through. The default adapter is in memory; the Redis adapter reaches every instance connected to the same [Redis](https://redis.io).

> [!WARNING] Scaling needs an adapter
> With several instances and the default memory adapter, clients on other instances silently miss events. Pass a Redis adapter before you scale past one instance.

Install an [ioredis](https://github.com/redis/ioredis) client:

```sh
pnpm add ioredis
```

Create the adapter once, in its own file, and pass it to every realtime link on the route table:

```ts
// server/realtime_adapter.ts
import { Redis } from 'ioredis'
import { createRedisRealtimeAdapter } from '@kitr/realtime/server'

export const realtimeAdapter = createRedisRealtimeAdapter(
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
  { prefix: 'acme-app:rt:' },
)
```

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import realtime from '@kitr/realtime/routes'
import { projectChannel } from '#app/channels/projects'
import { realtimeAdapter } from './realtime_adapter'

export const routes = defineRoutes([realtime], (r) =>
  r.ws('/api/ws', { channels: [projectChannel], adapter: realtimeAdapter }),
)
```

Add the connection string to `.env`:

```sh
REDIS_URL=redis://localhost:6379
```

Nothing else changes: an `emit` on any instance is published through Redis and every instance with a subscriber writes it to its own sockets.

<details>
<summary>What stays per instance, and adapter options</summary>

What the adapter does, and what stays per instance:

| Behaviour | With the Redis adapter |
| --- | --- |
| `emit()` | Reaches subscribers on every instance. |
| Redis subscriptions | One per topic per instance, only while a client watches it. |
| `ok` reply to a subscribe | Sent once the Redis subscription is live, so an emit right after the reply is not lost. |
| `use(channel, params).size` and `connections` | Count this instance only. |
| SSE control `POST`s | Forwarded through Redis to the instance that holds the stream. |
| Channel `authorize` and `onMessage` | Run on the instance that holds the connection, with that connection's context. |

The adapter takes these options:

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `'kitr:rt:'` | Prepended to every Redis channel, so apps sharing one Redis stay apart. |
| `subscriber` | `redis.duplicate()` | The connection that subscribes. A connection in subscriber mode runs no other command, so it must be a second one. |
| `onError` | `console.error` | Called when Redis rejects a publish or subscribe. An `emit` never throws because of Redis. |

WebSockets and SSE need no sticky sessions. Close the adapter on shutdown with `await realtimeAdapter.close()`. The [scaling guide](/guides/scale-out) runs the whole app on several instances.

</details>

With Socket.IO, use Socket.IO's own [Redis adapter](https://socket.io/docs/v4/redis-adapter/) instead:

```ts
// server/realtime.ts
import { createAdapter } from '@socket.io/redis-adapter'
import { attachSocketIo } from '@kitr/realtime/socket.io/server'
import { createClient } from 'redis'
import { Server } from 'socket.io'
import { projectChannel } from '#app/channels/projects'

const pub = createClient({ url: process.env.REDIS_URL })
const sub = pub.duplicate()
await Promise.all([pub.connect(), sub.connect()])

export const io = new Server({ path: '/api/socket.io', adapter: createAdapter(pub, sub) })
export const realtime = attachSocketIo(io, { channels: [projectChannel] })
```

Socket.IO also needs sticky sessions at the load balancer unless clients set `transports: ['websocket']`.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:channel <name>` | Writes `app/channels/<name>.ts` with `defineChannel`, a `zod` params schema, `updated` and `deleted` events and an open `authorize`. |

```sh
kitr make:channel invoices
```

```ts
// app/channels/invoices.ts
import { defineChannel } from '@kitr/realtime'
import { z } from 'zod'

export const invoicesChannel = defineChannel({
  name: 'invoices',
  params: z.object({ id: z.string() }),
  events: {
    updated: {
      effects: (data: unknown, { id }) => ({ set: [{ key: ['invoices', 'detail', id], data }] }),
    },
    deleted: {
      effects: () => ({ invalidate: [['invoices', 'list']] }),
    },
  },
  authorize: () => true,
})
```

Add the new channel to the `channels` of the `.ws()` link in `server/routes.ts`, or subscribers get `NOT_FOUND`.

## Errors

Errors travel as `{ code, message, status }` shapes to `onError`.

| Code | When | What to do |
| --- | --- | --- |
| `NOT_FOUND` | `Channel "invoices" not found`: the channel is not in the server's `channels`. | Add it to the `.ws()` link's `channels` in `server/routes.ts`. |
| `VALIDATION` (server) | The subscription params fail the channel's `params` schema. `fieldErrors` says which field. | Fix the params the component passes. |
| `VALIDATION` (client) | `Invalid payload for projects.updated`: an emitted payload fails the event `schema`. | Fix the data the server emits. |
| `FORBIDDEN` | The channel's `authorize` returned `false`: `Not allowed on channel "projects"`. | Expected for users without access; show a message. |
| HTTP `401` | The server's `authorize(request)` returned `false` or threw. The connection never opens. | Sign in, or send the cookie or token. |
| HTTP `410` | SSE only: a control `POST` named a connection the server no longer has. | The client reconnects and resubscribes on its own. |
| `NETWORK` | SSE only: a control `POST` failed. | Check the network; the subscription is not active. |
| `[@kitr/realtime] transport "socket.io": create the client with createSocketIoClient() from @kitr/realtime/socket.io` | `createRealtimeClient` with `transport: 'socket.io'`. | Use `createSocketIoClient` in `app/realtime.ts`. |

## Testing

Server and client both run in Node, so a test can start the real server on a free port and subscribe with the real client:

```ts
// test/project-channel.test.ts
import { defineRoutes } from '@kitr/kitr/app'
import { silentLogger } from '@kitr/logger'
import { channel, createSocketClient, type SocketTransport } from '@kitr/realtime'
import ws from '@kitr/realtime/routes'
import { createServer } from '@kitr/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { projectChannel } from '#app/channels/projects'

describe('projects channel', () => {
  const routes = defineRoutes([ws], (r) =>
    r.ws('/ws', {
      channels: [projectChannel],
      authorize: (request) => ({ user: new URL(request.url).searchParams.get('user') }),
    }),
  )
  const server = createServer({ logger: silentLogger, routes })
  const realtime = server.app.container.use('realtime')
  let base = ''
  let close: () => Promise<void>
  let client: SocketTransport

  beforeAll(async () => {
    const listening = await server.listen({ port: 0, host: '127.0.0.1' })
    base = listening.url.replace(/^http/, 'ws')
    close = listening.close
  })
  afterAll(async () => {
    client?.close()
    await close()
  })

  it('delivers updated projects to subscribers', async () => {
    client = createSocketClient({ url: `${base}/ws?user=ada`, reconnect: { maxRetries: 0 } })
    const events: unknown[] = []
    channel(client, projectChannel)
      .subscription()
      .subscribe({ id: 'prj_1' }, { next: (event) => events.push(event) })

    await vi.waitFor(() => expect(realtime.use(projectChannel, { id: 'prj_1' }).size).toBe(1))
    realtime
      .use(projectChannel, { id: 'prj_1' })
      .emit('updated', { id: 'prj_1', name: 'Apollo launch', teamId: 'team_acme' })

    await vi.waitFor(() =>
      expect(events).toEqual([
        { event: 'updated', data: { id: 'prj_1', name: 'Apollo launch', teamId: 'team_acme' } },
      ]),
    )
  })
})
```

`port: 0` picks a free port, and `vi.waitFor` retries until the subscription has reached the server. To test the cache after an event, call the subscription's `effects` directly:

```ts
// test/project-effects.test.ts
import { channel, type SocketTransport } from '@kitr/realtime'
import { expect, it } from 'vitest'
import { projectChannel } from '#app/channels/projects'

it('writes the project detail', () => {
  const idle = { subscribe: () => () => {} } as unknown as SocketTransport
  const effects = channel(idle, projectChannel).subscription().effects!
  const project = { id: 'prj_1', name: 'Apollo launch', teamId: 'team_acme' }
  expect(effects({ event: 'updated', data: project }, { id: 'prj_1' })).toEqual({
    set: [{ key: ['projects', 'detail', 'prj_1'], data: project }],
  })
})
```

For component tests, pass a memory transport (see [Extend](#extend)) instead of `realtime()` and push events from the test.

## Extend

Every client is a `SocketTransport`. Implement it to put channels on another service or to drive components from a test. This one keeps subscriptions in memory and lets the caller push events:

```ts
// test/memory-transport.ts
import type { SocketStatus, SocketTransport } from '@kitr/realtime'
import { topicFor } from '@kitr/realtime'

type Handler = (event: string, data: unknown) => void

export function createMemoryTransport() {
  const topics = new Map<string, Set<Handler>>()
  const sent: Array<{ channel: string; params: unknown; event: string; data: unknown }> = []
  const transport: SocketTransport & {
    push(channel: string, params: unknown, event: string, data: unknown): void
    sent: typeof sent
  } = {
    status: 'open' as SocketStatus,
    onStatus: () => () => {},
    subscribe(channel, params, onEvent) {
      const topic = topicFor(channel, params)
      if (!topics.has(topic)) topics.set(topic, new Set())
      topics.get(topic)!.add(onEvent)
      return () => topics.get(topic)?.delete(onEvent)
    },
    send(channel, params, event, data) {
      sent.push({ channel, params, event, data })
    },
    close() {
      topics.clear()
    },
    push(channel, params, event, data) {
      for (const handler of topics.get(topicFor(channel, params)) ?? []) handler(event, data)
    },
    sent,
  }
  return transport
}
```

Use it where the app expects a transport. `channel()`, `useChannel` and `useRealtimeStatus` only call these five members:

```tsx
// app/components/projects/project-title.test.tsx
import { act, screen } from '@testing-library/react'
import { queryProvider } from '@kitr/query'
import { useChannel } from '@kitr/realtime/react'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { expect, it } from 'vitest'
import { projectChannel } from '#app/channels/projects'
import { createMemoryTransport } from '../../../test/memory-transport'

const transport = createMemoryTransport()

function LastProjectName({ id }: { id: string }) {
  const live = useChannel(transport, projectChannel, { id })
  return <p>{live.lastEvent?.event === 'updated' ? live.lastEvent.data.name : 'Waiting'}</p>
}

it('shows the renamed project', async () => {
  const app = await createTestApp({ providers: [queryProvider] })
  renderWithKitr(<LastProjectName id="prj_1" />, { app })
  act(() =>
    transport.push('projects', { id: 'prj_1' }, 'updated', {
      id: 'prj_1',
      name: 'Apollo launch',
      teamId: 'team_acme',
    }),
  )
  expect(await screen.findByText('Apollo launch')).toBeTruthy()
})
```

| Member | Description |
| --- | --- |
| `subscribe(channel, params, onEvent, onError?)` | Start receiving events for a topic. Returns the unsubscribe function. |
| `send(channel, params, event, data)` | Send a client event to the server. |
| `close()` | Close the connection. |
| `status` | `'connecting'`, `'open'` or `'closed'`. |
| `onStatus(listener)` | Listen for status changes. Returns the remove function. |

A real transport also resubscribes after reconnecting. See [`SocketTransport`](/packages/realtime/api) in the API reference.

### Write a server adapter

A `RealtimeAdapter` carries emits between instances; implement it to use another bus. `subscribe(topic, handler)` starts delivering a topic's messages and returns the function that stops it, and `publish(topic, payload)` sends to every instance and returns how many received it. This one wraps Postgres `LISTEN`/`NOTIFY` with [`pg`](https://node-postgres.com):

```ts
// server/realtime/postgres_adapter.ts
import { createHash } from 'node:crypto'
import type { RealtimeAdapter } from '@kitr/realtime/server'
import type { Client } from 'pg'

export function createPostgresAdapter(listen: Client, notify: Client): RealtimeAdapter {
  const handlers = new Map<string, Set<(payload: string) => void>>()
  // Postgres channel names are short identifiers: hash each topic into one.
  const channel = (topic: string) => `rt_${createHash('sha1').update(topic).digest('hex')}`
  const topics = new Map<string, string>()
  listen.on('notification', (msg) => {
    const topic = topics.get(msg.channel)
    for (const handler of handlers.get(topic ?? '') ?? []) handler(msg.payload ?? '')
  })
  return {
    name: 'postgres',
    async subscribe(topic, handler) {
      if (!handlers.has(topic)) {
        handlers.set(topic, new Set())
        topics.set(channel(topic), topic)
        await listen.query(`LISTEN ${channel(topic)}`)
      }
      handlers.get(topic)!.add(handler)
      return () => {
        handlers.get(topic)?.delete(handler)
        if (handlers.get(topic)?.size) return
        handlers.delete(topic)
        void listen.query(`UNLISTEN ${channel(topic)}`)
      }
    },
    async publish(topic, payload) {
      await notify.query('SELECT pg_notify($1, $2)', [channel(topic), payload])
      // Postgres does not report receivers; 1 keeps SSE control forwarding working.
      return 1
    },
  }
}
```

Pass it as `adapter` on `.ws()` or `.sse()`, as with Redis. An adapter that cannot count receivers should return `1`: the SSE server answers `410` only when `publish` returns `0`.

## Next steps

- [API reference](/packages/realtime/api): every export of the seven entry points.
- [query](/packages/query): the cache that `effects` write to, and `useSubscription`.
- [Run on more than one instance](/guides/scale-out): Redis for sockets, cache, queue and limits.
