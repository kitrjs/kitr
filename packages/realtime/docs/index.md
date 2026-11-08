---
title: Realtime
description: Define a live channel once and push updates to every open screen, over WebSockets, Socket.IO or server events.
order: 1
---

# Realtime

A chat, a notification bell, a project board that updates while you look at it: all of them need the server to push to screens that are already open. `kitr/realtime` lets you define a typed **channel** once, emit events on it from the server, and have every subscribed screen update its query cache. It runs over [crossws](https://crossws.unjs.io) WebSockets by default, or [Socket.IO](https://socket.io/docs/v4/) or Server-Sent Events, and the channel code stays the same on all three.

It runs on both sides: the server half (`kitr/realtime/server`) accepts connections and emits; the client half (`kitr/realtime`, `kitr/realtime/react`) subscribes. For one-off server calls that return a value, use [actions](/packages/actions) or [api](/packages/api) instead; realtime is for events the server sends when something changes.

This guide follows Acme's project board at `app.acme.com`. When Grace renames a project, Ada and Linus see the new name without reloading.

## Install

```sh
kitr add realtime
```

What `kitr add` does:

- Adds the [server](/packages/server) package first if the project does not have it yet.
- Installs `@kitr/realtime` and `crossws`. In a React app it also installs `partysocket`, the reconnecting WebSocket client.
- Adds `'@kitr/realtime'` to `packages` in `kitrrc.ts`. Realtime registers no provider.
- Writes `config/realtime.ts` (shown under Configure).
- Writes `app/channels/example.ts`, a sample channel named `example` with one `message` event.
- Adds `realtime` from `kitr/realtime/routes` to the extension list of the server route table (`server/routes.ts`, created with an empty table when missing) and appends `.ws('<path>', { channels: [exampleChannel] })` to it, with the path from `config/realtime.ts`. The table is what `createServer({ routes })` in `server/main.ts` serves; a `server/main.ts` written before the table existed gets the `routes` option added.
- In a React app, writes `app/realtime.ts`, which opens one client connection per tab on first use.
- Regenerates `config/index.ts`, the config list the standalone server imports.
- Adds a `## kitr: realtime` section to `AGENTS.md` that says where channels live, how the server emits and how components subscribe, and how to switch transports.

`kitr add realtime` asks no questions. It checks for React instead: a project without React (a pure backend) gets the `/ws` path and no client files. Pass `--dry-run` to print the changes without writing them:

```sh
kitr add realtime --dry-run
```

The `fullstack` and `server` kits and the `realtime` kit already include it. `kitr remove realtime` removes the package entry, the `AGENTS.md` section, `config/realtime.ts` and the `crossws`, `partysocket`, `socket.io` and `socket.io-client` dependencies. It takes `realtime` out of the table's extension list and leaves `app/channels/` and `app/realtime.ts` in place, because you have likely edited them; when `server/routes.ts` still has `.ws()` or `.sse()` links it tells you to delete them.

## Configure

In a React app, `kitr add realtime` writes this file:

```ts
// config/realtime.ts
import { defineConfig } from 'kitr/realtime'

export default defineConfig({
  // websocket (default), socket.io or sse: the channels and hooks stay the same.
  transport: 'websocket',
  path: '/api/ws',
})
```

In a project without React, the path is `'/ws'` instead of `'/api/ws'`.

The client reads this file through `createRealtimeClient(config)`. The server does not read it: the `.ws(path, ...)` link in `server/routes.ts` carries its own path and decides which server to create. Keep the two in step when you change either.

| Option | Default | Description |
| --- | --- | --- |
| `transport` | `'websocket'` | `'websocket'` (crossws and partysocket), `'socket.io'` (rooms, adapters) or `'sse'` (one-way stream over HTTP, control messages over POST). |
| `path` | `'/ws'`, or `'/events'` for `sse` | Where the server listens. The client connects to the same origin at this path. |
| `url` | same origin at `path` | A full URL for the client, such as `wss://realtime.acme.com/ws`, when the realtime server is on another host. |
| `heartbeat` | `25000` | WebSocket only: milliseconds between client pings. A ping still unanswered when the next one is due means the connection is dead, and the client reconnects. `0` turns pings off. |

Realtime adds no environment variables.

## Push your first update

Three files make a live project name: a channel both ends import, an emit on the server, and a subscription in a component.

Define the channel. `zod` is used for schemas here (`pnpm add zod`); any [Standard Schema](https://standardschema.dev) library works.

```ts
// app/channels/projects.ts
import { defineChannel } from 'kitr/realtime'
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
import { defineRoutes } from 'kitr/app'
import api from 'kitr/api/routes'
import realtime from 'kitr/realtime/routes'
import { projectChannel } from '#app/channels/projects'
import ProjectsController from '#server/controllers/projects_controller'

export const routes = defineRoutes([api, realtime], (root) =>
  root.group('/api', (r) =>
    r.resource('projects', ProjectsController).ws('/ws', { channels: [projectChannel] }),
  ),
)

export type ServerRoutes = typeof routes.$types
```

`.ws(path, options)` is a route like any other: `createServer({ routes })` in `server/main.ts` mounts the WebSocket server at `/api/ws` and binds it in the app container as `realtime`, so every controller, action and job reaches it through `app.container.use('realtime')`:

```ts
// server/controllers/projects_controller.ts
import type { HttpContext } from 'kitr/api'
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
// app/features/projects/project-title.tsx
import { useQuery } from 'kitr/query'
import { useChannel } from 'kitr/realtime/react'
import { type Project, projectChannel } from '#app/channels/projects'
import { realtime } from '#app/realtime'

export function ProjectTitle({ id }: { id: string }) {
  useChannel(realtime(), projectChannel, { id })
  const { data } = useQuery<Project>({ queryKey: ['projects', 'detail', id], enabled: false })
  return <h1>{data?.name ?? 'Loading'}</h1>
}
```

When Grace saves "Apollo launch", the server sends one `updated` event to every connection subscribed to `projects` with `{ id: 'prj_1' }`. Each client validates the payload against `projectSchema` and runs `effects`, which writes the project into the `['projects', 'detail', 'prj_1']` cache entry. Ada's and Linus's headings re-render with the new name. No refetch happens.

## Define a channel

A channel is a name, the params a subscriber picks, and the events the server sends. One file under `app/channels/` is imported by both ends, so the event names and payload types cannot drift.

```ts
// app/channels/projects.ts
import { defineChannel } from 'kitr/realtime'
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
| `authorize(params, ctx)` | server | Return `false` to refuse a subscription. See Authorize a subscription. |
| `onMessage(event, data, params, ctx)` | server | Receives events a client sends up the channel. |

`kitr make:channel <name>` writes a starting file (see Commands). Without a `params` schema, give the params type as a type argument: `defineChannel<{ room: string }>({ ... })`.

## Validate params and payloads

On the server, `params` runs before anything else. Its output, not the raw input, is what the subscription is filed under. A schema that trims or lowercases therefore merges `' prj_1 '` and `'prj_1'` into one topic.

On the client, an event with a `schema` is validated before `effects` runs. A payload that fails is not applied; the subscription's error handler gets a `VALIDATION` error instead:

```ts
// app/features/projects/project-errors.ts
import { channel } from 'kitr/realtime'
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

> **Warning**
> The server does not validate what you pass to `emit`. Payload schemas protect clients from a malformed event; they do not stop the server from sending one. Emit data you built from your own records.

## Update the cache from events

`effects(data, params)` returns the same cache effect a [query](/packages/query) mutation returns: `set` writes an entry, `invalidate` marks entries stale so mounted queries refetch, `remove` drops them.

```ts
// app/channels/projects.ts
import { defineChannel } from 'kitr/realtime'
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

Use `set` when the event carries the full record. Use `invalidate` when it only says something changed; the query refetches through its normal `fetch`, so permission checks and joins stay on the server. Don't call `queryClient.setQueryData` in a component for socket events; declare it in `effects` so every subscriber behaves the same.

## Emit from the server

On the server, `realtime.use(channel, params)` returns an emitter for one topic. The server is bound in the app container as `realtime` by the `.ws()` link, so read it from the app you already have: `ctx.app` in a controller, or the server's app anywhere else, such as an action or a job:

```ts
// app/actions/projects/rename.ts
import { defineMutation } from 'kitr/actions'
import { z } from 'zod'
import { projectChannel } from '#app/channels/projects'
import { server } from '#server/main'

export const renameProject = defineMutation('projects.rename', {
  input: z.object({ id: z.string(), name: z.string().min(2) }),
  handler: async ({ input }) => {
    const project = { id: input.id, name: input.name, teamId: 'team_acme' }
    // ... save it with your database
    server.app.container.use('realtime').use(projectChannel, { id: input.id }).emit('updated', project)
    return project
  },
})
```

The emitter also reports how many connections are listening, which helps you skip expensive work nobody will see:

```ts
// server/jobs/project_stats.ts
import { projectChannel } from '#app/channels/projects'
import { server } from '#server/main'

const realtime = server.app.container.use('realtime')
const topic = realtime.use(projectChannel, { id: 'prj_1' })
console.log(topic.size)
// => 2 (Ada and Linus have the board open)
console.log(realtime.connections)
// => 3 (open WebSocket connections, subscribed or not)
```

Emit with the params as the server normalised them. With `z.string().trim()` above, `use(projectChannel, { id: 'prj_1' })` reaches a client that subscribed with `' prj_1 '`; `use(projectChannel, { id: ' prj_1 ' })` reaches nobody. Key order in params does not matter: `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` are the same topic.

## Subscribe in a component

In a component, `useChannel(transport, channel, params, options?)` from `kitr/realtime/react` subscribes on mount, applies each event's `effects` to the query cache, and unsubscribes on unmount. It needs the [query](/packages/query) provider, which every kit with React includes.

```tsx
// app/features/projects/project-board.tsx
import { useChannel } from 'kitr/realtime/react'
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

Changing `params` resubscribes. `app/realtime.ts` opens the connection the first time `realtime()` runs, so render subscribing components in the browser only: a route with `ssrRoute(false)` from [seo](/packages/seo), or a component that mounts after hydration.

## Subscribe with useSubscription

`channel(transport, definition)` binds a channel to a transport. Its `subscription()` is a kitr subscription contract, so `useSubscription` and `subscriptionFrom` from [query](/packages/query) take it directly. Use this when your queries file already holds the other contracts for a feature:

```ts
// app/features/projects/queries.ts
import { subscriptionFrom } from 'kitr/query'
import { channel } from 'kitr/realtime'
import { projectChannel } from '#app/channels/projects'
import { realtime } from '#app/realtime'

/** Call inside a component, so the socket opens in the browser. */
export const projectSubscription = () =>
  subscriptionFrom(channel(realtime(), projectChannel).subscription())
```

```tsx
// app/features/projects/project-live.tsx
import { useSubscription } from 'kitr/query'
import { useMemo } from 'react'
import { projectSubscription } from './queries'

export function ProjectLive({ id }: { id: string }) {
  const subscription = useMemo(() => projectSubscription(), [])
  const live = useSubscription(subscription, { id })
  return <span>{live.status}</span>
}
```

The handle's `key(params)` is `['realtime', 'projects', { id: 'prj_1' }]`. It names the subscription; events still write to the keys your `effects` return.

## Show the connection status

`useChannel` reports the subscription. To show whether the socket itself is connected, use `useRealtimeStatus(transport)`:

```tsx
// app/components/connection-badge.tsx
import { useRealtimeStatus } from 'kitr/realtime/react'
import { realtime } from '#app/realtime'

export function ConnectionBadge() {
  const status = useRealtimeStatus(realtime())
  // => 'connecting' | 'open' | 'closed'
  return <span>{status === 'open' ? 'Online' : 'Reconnecting'}</span>
}
```

The WebSocket client reconnects on its own with backoff and sends every subscription again after it reconnects. Events emitted while a client was offline are not replayed, so pair live events with queries: on reconnect, invalidate what matters, or let `refetchOnWindowFocus` catch up.

## Send events from the client

A client can send an event up a channel with `channel(...).send(params, event, data)`. The server runs the channel's `params` schema and `authorize`, then calls the channel's `onMessage`. Here, typing in a project's comment box tells everyone else on the board.

The channel declares the `typing` event, so clients can receive it:

```ts
// app/channels/projects.ts
import { defineChannel } from 'kitr/realtime'
import { z } from 'zod'

export const projectChannel = defineChannel({
  name: 'projects',
  params: z.object({ id: z.string() }),
  events: {
    typing: { schema: z.object({ user: z.string() }) },
  },
})
```

The server adds `onMessage` to its copy of the channel. The server matches channels by `name`, so the client keeps importing the shared file and the handler never reaches the browser:

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
// app/features/projects/comment-box.tsx
import { channel } from 'kitr/realtime'
import { projectChannel } from '#app/channels/projects'
import { realtime } from '#app/realtime'

export function CommentBox({ projectId }: { projectId: string }) {
  const project = channel(realtime(), projectChannel)
  return <textarea onKeyDown={() => project.send({ id: projectId }, 'typing', { user: 'Ada' })} />
}
```

`onMessage(event, data, params, ctx, realtime)` receives the validated params, the connection's context and the server that got the message, to emit back. Check `data` yourself, as above: event schemas are checked when events arrive at a client, not at the server. For anything that changes data, call an action or an API route instead; `send` has no reply and no retry.

## Authenticate connections

On the server, `authorize(request)` runs once, when a connection opens. Return the connection's context, such as the signed-in user. Return `false` and the upgrade is refused with `401 Unauthorized`. Throw a `KitrError` to refuse with its status; any other thrown error becomes a 401.

```ts
// server/routes.ts
import { KitrError } from 'kitr/app'
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

`userFromSession` stands for your own lookup. Browsers send cookies with the WebSocket upgrade for the same site, so a session cookie works without extra client code. For a token, put it in the URL from the client and read it with `new URL(request.url).searchParams.get('token')`:

```ts
// app/realtime.ts
import { createSocketClient, type SocketTransport } from 'kitr/realtime'
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

## Authorize a subscription

`authorize(params, ctx)` on the channel decides who may subscribe to which topic. `ctx` is what the server's `authorize(request)` returned. It also guards `send`.

```ts
// app/channels/projects.ts
import { defineChannel } from 'kitr/realtime'
import { z } from 'zod'

type Ctx = { user: { id: string; teamIds: string[] } }

export const projectChannel = defineChannel({
  name: 'projects',
  params: z.object({ id: z.string(), teamId: z.string() }),
  events: { updated: {} },
  authorize: ({ teamId }, ctx) => (ctx as Ctx).user.teamIds.includes(teamId),
})
```

When Linus, who is not on `team_acme`, subscribes with `{ id: 'prj_1', teamId: 'team_acme' }`, his `useChannel` gets `error: { code: 'FORBIDDEN', message: 'Not allowed on channel "projects"', status: 403 }` and receives no events. A channel without `authorize` lets every authenticated connection subscribe.

## Handle errors

Errors reach the most specific handler. Subscription errors (bad params, `FORBIDDEN`, an unknown channel name) go to that subscription's `onError`. Errors with no subscription, such as a `send` on an unknown channel, go to the transport's `onError`:

```ts
// app/realtime.ts
import { createSocketClient, type SocketTransport } from 'kitr/realtime'
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

This is the same file `kitr add` writes, with `createSocketClient` called directly so you can pass the options it takes:

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

When the realtime server runs on its own host, set `url` in config. The client uses it as is, instead of the page's origin plus `path`:

```ts
// config/realtime.ts
import { defineConfig } from 'kitr/realtime'

export default defineConfig({
  transport: 'websocket',
  path: '/ws',
  url: 'wss://realtime.acme.com/ws',
})
```

From a Node script or a test, there is no page origin. Call `createSocketClient` with a full URL; Node 22 and later ship a global `WebSocket`:

```ts
// scripts/watch_project.ts
import { channel, createSocketClient } from 'kitr/realtime'
import { projectChannel } from '#app/channels/projects'

const transport = createSocketClient({ url: 'ws://localhost:3001/ws' })
channel(transport, projectChannel)
  .subscription()
  .subscribe({ id: 'prj_1' }, { next: (event) => console.log(event) })
// => { event: 'updated', data: { id: 'prj_1', name: 'Apollo launch', teamId: 'team_acme' } }
```

## The server in the container

The first `.ws()` or `.sse()` link on the table binds its server in the app container as `realtime`, as the transport-neutral `RealtimeServer` (`use`, `attach`, `connections`). That is the one controllers, actions and jobs emit through, and a second link's server is reachable only through what `routes.compile('h3', server)` returned. To run a realtime server you build yourself, outside the table, `createRealtimeServer(options)` from `kitr/realtime/server` still returns one with `attach(server, path)`, and `realtimeProvider(options)` binds one as `realtime` without a route; `sseProvider` from `kitr/realtime/sse/server` does the same for SSE. `attach` must run before `server.listen()`, because it turns on WebSocket support for the listener.

## Transports

All three transports implement one client interface and share the wire protocol, so channels, `effects`, `useChannel` and `emit` are identical. What changes is the link on the server route table (`.ws` or `.sse`, or a Socket.IO server you attach yourself) and the client the app creates.

| `transport` | Client | Server | Use it when |
| --- | --- | --- | --- |
| `websocket` | `createSocketClient` (partysocket) | `createRealtimeServer`, which uses `createSocketServer` (crossws via h3) | The default. Two-way, low latency, runs on Node, Bun, Deno and Cloudflare. |
| `socket.io` | `createSocketIoClient` | `attachSocketIo` | You already run Socket.IO or need its rooms and adapters. |
| `sse` | `createSseTransport` (EventSource plus POST) | `createRealtimeServer`, which uses `createSseServer` | Your host or proxy does not allow WebSocket upgrades. |

### WebSocket

The default. `kitr add realtime` sets it up: `crossws` on the server, `partysocket` in the browser.

```ts
// server/routes.ts
import { defineRoutes } from 'kitr/app'
import realtime from 'kitr/realtime/routes'
import { projectChannel } from '#app/channels/projects'
import realtimeConfig from '../config/realtime'

export const routes = defineRoutes([realtime], (r) =>
  // WebSocket upgrades on /api/ws, next to the routes.
  r.ws('/api/ws', { channels: [projectChannel] }),
)
```

```ts
// server/main.ts
import { createServer } from 'kitr/server'
import { routes } from './routes'
import { config } from '../config'
import rc from '../kitrrc'

export const server = createServer({ providers: rc.providers, config, routes })
```

`.ws(path, options)` takes `channels`, `authorize`, `adapter` and the other `createRealtimeServer` options. Mounting it registers the upgrade route on the server's h3 app and turns on `websocket` for `server.listen()`. Without `crossws` installed, `listen()` throws `[kitr/server] websocket: true needs the crossws package. Run kitr add socket.` See the [crossws docs](https://crossws.unjs.io) for runtime adapters.

### Socket.IO

Install both halves:

```sh
pnpm add socket.io socket.io-client
```

Set the transport and path in config:

```ts
// config/realtime.ts
import { defineConfig } from 'kitr/realtime'

export default defineConfig({
  transport: 'socket.io',
  path: '/api/socket.io',
})
```

On the server, create a Socket.IO server and serve your channels on it with `attachSocketIo`. Its `authorize` receives the socket and reads `socket.handshake.auth`:

```ts
// server/realtime.ts
import { KitrError } from 'kitr/app'
import { attachSocketIo } from 'kitr/realtime/socket.io/server'
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
import { createServer } from 'kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { io } from './realtime'
import { routes } from './routes'

export const server = createServer({ providers: rc.providers, config, routes })
const listening = await server.listen({ port: 3001 })
io.attach(listening.node as HttpServer)
```

In the browser, `createRealtimeClient` refuses `socket.io` so that `socket.io-client` stays out of bundles that don't use it. Create the client from `kitr/realtime/socket.io`, which also exports `channel` and `defineChannel`:

```ts
// app/realtime.ts
import type { SocketTransport } from 'kitr/realtime'
import { createSocketIoClient } from 'kitr/realtime/socket.io'
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

`createSocketIoClient` takes every [socket.io-client option](https://socket.io/docs/v4/client-options/) plus `url` and `onError`, and exposes the raw socket as `.socket`. Each channel topic is a Socket.IO room, so `realtime.use(channel, params).emit()` emits to that room. Pass `namespace: '/board'` to `attachSocketIo` to serve channels on a namespace. The Socket.IO emitter has no `size`.

### Server-Sent Events

SSE needs no extra packages. The server streams events over one long `GET`; the client subscribes and sends with `POST`s to the same path. Set the transport in config, and the `server/realtime.ts` and `app/realtime.ts` that `kitr add` wrote switch with it:

```ts
// config/realtime.ts
import { defineConfig } from 'kitr/realtime'

export default defineConfig({
  transport: 'sse',
  path: '/api/events',
})
```

```ts
// server/routes.ts
r.sse('/api/events', { channels: [projectChannel], keepAlive: 15_000 })
```

`.sse(path, options)` mounts the stream and its control endpoint on one path, and binds the server as `realtime` when it is the first socket link on the table.

The `app/realtime.ts` that `kitr add` wrote already works: `createRealtimeClient` returns `createSseTransport({ url: config.url ?? config.path })` for `sse`. To pass headers on the control `POST`s, create the transport yourself:

```ts
// app/realtime.ts
import { createSseTransport, type SocketTransport } from 'kitr/realtime'

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

`EventSource` cannot set headers, so the stream authenticates by cookie (it is opened with credentials) or by a `?token=` in the URL. As with WebSocket, the server sends back the params the `params` schema output, so a subscription with `' prj_1 '` receives events emitted for `'prj_1'`. See [MDN on Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

## Run more than one server instance

On the server, each instance keeps its own connections. With two instances behind a load balancer, Ada's browser holds a socket to instance A and Linus's to instance B. To make an `emit` on either instance reach both, give the realtime server an **adapter**: the shared bus instances publish through. The default adapter is in memory and reaches only its own process; the Redis adapter reaches every instance connected to the same [Redis](https://redis.io).

> **Warning**
> With the WebSocket or SSE transport, several instances and the default memory adapter, clients on other instances silently miss events. Pass a Redis adapter before you scale past one instance.

Install a Redis client. kitr's Redis adapters take an [ioredis](https://github.com/redis/ioredis) client:

```sh
pnpm add ioredis
```

Create the adapter once, in its own file, and pass it to every realtime link on the route table:

```ts
// server/realtime_adapter.ts
import { Redis } from 'ioredis'
import { createRedisRealtimeAdapter } from 'kitr/realtime/server'

export const realtimeAdapter = createRedisRealtimeAdapter(
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
  { prefix: 'acme-app:rt:' },
)
```

```ts
// server/routes.ts
import { defineRoutes } from 'kitr/app'
import realtime from 'kitr/realtime/routes'
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

Nothing else changes. Grace's rename on instance A calls `realtime.use(projectChannel, { id: 'prj_1' }).emit('updated', project)` as before; the adapter publishes it on the Redis channel `acme-app:rt:projects:{"id":"prj_1"}`, and every instance with a subscriber for that topic writes it to its own sockets. Ada and Linus both see the new name.

What the adapter does, and what stays per instance:

| Behaviour | With the Redis adapter |
| --- | --- |
| `emit()` | Reaches subscribers on every instance. |
| Redis subscriptions | One per topic per instance, made when the topic's first local client subscribes and dropped after the last leaves. Traffic follows what clients watch, not the instance count. |
| `ok` reply to a subscribe | Sent once the Redis subscription is live, so an emit right after the reply is not lost. |
| `use(channel, params).size` and `connections` | Count this instance only. |
| SSE control `POST`s | A `POST` that the load balancer sends to another instance than the stream is forwarded through Redis to the instance that holds the stream. A connection id no instance holds still answers `410`, and the client opens a new stream. |
| Channel `authorize` and `onMessage` | Run on the instance that holds the connection, with that connection's context. |

The adapter takes these options:

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `'kitr:rt:'` | Prepended to every Redis channel, so apps sharing one Redis stay apart. |
| `subscriber` | `redis.duplicate()` | The connection that subscribes. A connection in subscriber mode runs no other command, so it must be a second one. |
| `onError` | `console.error` | Called when Redis rejects a publish or subscribe. An `emit` never throws because of Redis. |

WebSockets need no sticky sessions: a socket stays on the instance it opened on. SSE needs none either, because control `POST`s are forwarded. Close the adapter on shutdown with `await realtimeAdapter.close()`, for example in a provider's `shutdown()`. The [scaling guide](/guides/scale-out) runs the whole app on several instances.

With Socket.IO, use Socket.IO's own [Redis adapter](https://socket.io/docs/v4/redis-adapter/) instead, and every instance's emits reach every room:

```ts
// server/realtime.ts
import { createAdapter } from '@socket.io/redis-adapter'
import { attachSocketIo } from 'kitr/realtime/socket.io/server'
import { createClient } from 'redis'
import { Server } from 'socket.io'
import { projectChannel } from '#app/channels/projects'

const pub = createClient({ url: process.env.REDIS_URL })
const sub = pub.duplicate()
await Promise.all([pub.connect(), sub.connect()])

export const io = new Server({ path: '/api/socket.io', adapter: createAdapter(pub, sub) })
export const realtime = attachSocketIo(io, { channels: [projectChannel] })
```

Socket.IO also needs sticky sessions at the load balancer unless clients use only the `websocket` transport (`transports: ['websocket']` on the client).

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:channel <name>` | Writes `app/channels/<name>.ts` with `defineChannel`, a `zod` params schema, `updated` and `deleted` events and an open `authorize`. |

```sh
kitr make:channel invoices
```

```ts
// app/channels/invoices.ts
import { defineChannel } from 'kitr/realtime'
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

The file name is the snake-case form of the name. Add the new channel to the `channels` of the `.ws()` link in `server/routes.ts`; a client that subscribes to a channel the server does not list gets `NOT_FOUND`.

## Errors

Errors travel as kitr error shapes (`{ code, message, status }`) to the subscription's `onError`, or to the transport's `onError` when there is no subscription.

| Code | When | What to do |
| --- | --- | --- |
| `NOT_FOUND` | `Channel "invoices" not found`: the channel is not in the server's `channels`. | Add it to the `.ws()` link's `channels` in `server/routes.ts`. |
| `VALIDATION` (server) | The subscription params fail the channel's `params` schema. `fieldErrors` says which field. | Fix the params the component passes. |
| `VALIDATION` (client) | `Invalid payload for projects.updated`: an emitted payload fails the event `schema`. | Fix the data the server emits. |
| `FORBIDDEN` | The channel's `authorize` returned `false`: `Not allowed on channel "projects"`. | Expected for users without access; show a message. |
| HTTP `401` | The server's `authorize(request)` returned `false` or threw. The connection never opens. | Sign in, or send the cookie or token. |
| HTTP `410` | SSE only: a control `POST` named a connection the server no longer has. | The client reconnects and resubscribes on its own. |
| `NETWORK` | SSE only: a control `POST` failed. | Check the network; the subscription is not active. |
| `[kitr/realtime] transport "socket.io": create the client with createSocketIoClient() from kitr/realtime/socket.io` | `createRealtimeClient` with `transport: 'socket.io'`. | Use `createSocketIoClient` in `app/realtime.ts`. |

## Testing

Server and client both run in Node, so a test can start the real server on a free port and subscribe with the real client. This checks the channel, the authorization and the emit together:

```ts
// test/project_channel.test.ts
import { defineRoutes } from 'kitr/app'
import { silentLogger } from 'kitr/logger'
import { channel, createSocketClient, type SocketTransport } from 'kitr/realtime'
import ws from 'kitr/realtime/routes'
import { createServer } from 'kitr/server'
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

`port: 0` picks a free port, and `vi.waitFor` retries until the subscription has reached the server. The test uses the channel from "Push your first update".

To test what the cache looks like after an event, call the subscription's `effects` directly. It is a plain function:

```ts
// test/project_effects.test.ts
import { channel, type SocketTransport } from 'kitr/realtime'
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

For component tests, pass a memory transport (see Extend) instead of `realtime()`, render with `renderWithKitr` from [testing](/packages/testing), and push events from the test.

## Extend

Every client is a `SocketTransport`. Implement it to put channels on another service, such as a hosted pub/sub, or to drive components from a test. This one keeps subscriptions in memory and lets the caller push events:

```ts
// test/memory-transport.ts
import type { SocketStatus, SocketTransport } from 'kitr/realtime'
import { topicFor } from 'kitr/realtime'

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
// app/features/projects/project-title.test.tsx
import { act, screen } from '@testing-library/react'
import { queryProvider } from 'kitr/query'
import { useChannel } from 'kitr/realtime/react'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
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

A real transport also resubscribes after reconnecting and calls `onError` with a kitr error shape. Read `createSseTransport` in the source for a short complete example, and see [`SocketTransport`](/packages/realtime/api) in the API reference.

### Write a server adapter

On the server, a `RealtimeAdapter` carries emits between instances. Implement it to use another bus, such as NATS or Postgres `LISTEN`/`NOTIFY`. It has two methods: `subscribe(topic, handler)` starts delivering a topic's messages to this process and returns (or resolves with) the function that stops it, and `publish(topic, payload)` sends a message to every instance and returns how many received it. This one wraps a Postgres client from [`pg`](https://node-postgres.com):

```ts
// server/realtime/postgres_adapter.ts
import { createHash } from 'node:crypto'
import type { RealtimeAdapter } from 'kitr/realtime/server'
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

Pass it as `adapter` on `.ws()` or `.sse()`, as with the Redis adapter. An adapter whose `publish` cannot count receivers should return `1`: the SSE server answers `410` only when `publish` returns `0`. See [`RealtimeAdapter`](/packages/realtime/api) in the API reference.

## Next steps

- [API reference](/packages/realtime/api): every export of the seven entry points.
- [query](/packages/query): the cache that `effects` write to, and `useSubscription`.
- [server](/packages/server): `createServer`, `listen` and shutdown.
- [crossws](https://crossws.unjs.io) and [Socket.IO](https://socket.io/docs/v4/): the libraries underneath.
- [Getting started](/docs/getting-started): the `realtime` kit, a chat room built on these pieces.
- [Run on more than one instance](/guides/scale-out): Redis for sockets, cache, queue and limits.
