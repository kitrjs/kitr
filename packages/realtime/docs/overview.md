---
title: Overview
description: Define a live channel once and push updates to every open screen, over WebSockets, Socket.IO or server events.
order: 0
---

# Realtime

A chat, a notification bell, a project board that updates while you look at it: all of them need the server to push to screens that are already open. Raw WebSockets give you a pipe and nothing else: no typed events, no authorization per channel, no connection to the data the screens already hold, and a rewrite if you move from one transport to another.

`@kitr/realtime` lets you define a typed channel once, emit on it from the server, and have every subscribed screen update its cache, on any of three transports.

## What it is

`@kitr/realtime` is built around channels. `defineChannel` declares a channel's params and its events with schemas. The server half (`@kitr/realtime/server`) accepts connections, authenticates them, authorizes each subscription and emits events. The client half (`@kitr/realtime` and `@kitr/realtime/react`) subscribes with `useChannel` or through a [query](/packages/query) subscription, and each event's `effects` update the cache so components re-render with the new data. `useRealtimeStatus` drives a connection indicator.

It runs on both sides. For one-off server calls that return a value, use [actions](/packages/actions) or [API routes](/packages/api) instead; realtime is for events the server sends when something changes.

## Install

```sh
kitr add realtime
```

This installs `@kitr/realtime` with crossws (and partysocket in a React app), writes `config/realtime.ts`, an example channel in `app/channels/example.ts` and the client in `app/realtime.ts`, and mounts a `.ws()` route on the server route table. It adds [server](/packages/server) first when the project does not have it. The guide's [Install](/packages/realtime/guide#install) section lists every change.

## Quick start

Three files make a live project name: a channel both ends import, an emit on the server, and a subscription in a component. The channel names its params, its events and what each event does to the query cache:

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

Add `projectChannel` to the `.ws('/ws', { channels: [...] })` route in `server/routes.ts`, then emit from the controller that renames a project:

```ts
// server/controllers/projects_controller.ts
app.container.use('realtime').use(projectChannel, { id: params.id }).emit('updated', project)
```

Subscribe in the component that shows the project:

```tsx
// app/features/projects/project-title.tsx
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

When Grace saves "Apollo launch", the server sends one `updated` event to every connection subscribed to that project. Each client validates the payload against `projectSchema` and runs `effects`, which writes the project into the cache entry. Ada's heading re-renders with the new name. No refetch happens. The guide continues from here: [Push your first update](/packages/realtime/guide#push-your-first-update).

## Built on

| Transport | Built on | Use it for |
| --- | --- | --- |
| WebSockets (default) | [crossws](https://crossws.unjs.io) on the [h3](https://h3.dev) server | Most apps, on Node, Bun, Deno and Workers. |
| Socket.IO | [Socket.IO](https://socket.io/docs/v4/) | Existing Socket.IO clients, rooms and its reconnection behavior. |
| Server-Sent Events | The browser's `EventSource` | Hosts that block WebSockets, or one-way updates. |

The channel code is the same on all three. kitr adds `defineChannel`, params and payload validation with [Standard Schema](https://standardschema.dev), authentication and per-channel authorization, the cache effects, the React hooks, [PartySocket](https://github.com/partykit/partykit/tree/main/packages/partysocket) reconnection on the WebSocket client, and a route extension so sockets sit in the same route table as pages and endpoints.

## Problems it solves

- **Untyped messages.** A channel declares its events and payloads; emitting the wrong shape is a type error and a bad payload is rejected. See [Define a channel](/packages/realtime/guide#define-a-channel).
- **Screens that do not update.** Events carry cache effects, so the query cache changes and components follow. See [Update the cache from events](/packages/realtime/guide#update-the-cache-from-events).
- **Anyone subscribing to anything.** Authenticate the connection and authorize each subscription against the user. See [Authorize a subscription](/packages/realtime/guide#authorize-a-subscription).
- **Connection state nobody shows.** `useRealtimeStatus` for a banner or a dot. See [Show the connection status](/packages/realtime/guide#show-the-connection-status).
- **Changing transport later.** Swap WebSockets for Socket.IO or SSE in config; channels stay as they are. See [Transports](/packages/realtime/guide#transports).
- **Several server instances.** Fan events out across instances. See [Run more than one server instance](/packages/realtime/guide#run-more-than-one-server-instance).

## Further reading

- [Guide](/packages/realtime/guide): install, configure and every task.
- [API reference](/packages/realtime/api): every export of the seven entry points.
- [crossws](https://crossws.unjs.io) and [Socket.IO](https://socket.io/docs/v4/): the libraries underneath.
- [Query](/packages/query) and [Server](/packages/server): the cache effects write to, and the server connections attach to.
- [Getting started](/docs/getting-started): the `realtime` kit, a chat room built on these pieces.
