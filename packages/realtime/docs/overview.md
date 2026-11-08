---
title: Overview
description: Define a live channel once and push updates to every open screen, over WebSockets, Socket.IO or server events.
order: 0
---

# Realtime

## What it is

`@kitr/realtime` pushes events from the server to the browser over channels. `defineChannel` declares a channel's params and events with schemas. The server emits; `useChannel` subscribes; each event's `effects` update the [query](/packages/query) cache so components re-render.

Runs on both sides. For one-off calls that return a value, use [actions](/packages/actions) or [API routes](/packages/api).

## Install

```sh
kitr add realtime
```

Adds `@kitr/realtime` with crossws and partysocket, `config/realtime.ts`, an example channel, the client in `app/realtime.ts` and a `.ws()` route. Adds [server](/packages/server) first if missing. [Every change](/packages/realtime/guide#install).

## Quick start

A channel both ends import, an emit on the server, a subscription in a component. First the channel:

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

When Grace saves a new name, every subscribed client validates the event and writes it into the cache. Ada's heading re-renders. No refetch. Next in the guide: [Push your first update](/packages/realtime/guide#push-your-first-update).

## Built on

| Transport | Built on | Use it for |
| --- | --- | --- |
| WebSockets (default) | [crossws](https://crossws.unjs.io) on the [h3](https://h3.dev) server | Most apps, on Node, Bun, Deno and Workers. |
| Socket.IO | [Socket.IO](https://socket.io/docs/v4/) | Existing Socket.IO clients, rooms and its reconnection behavior. |
| Server-Sent Events | The browser's `EventSource` | Hosts that block WebSockets, or one-way updates. |

kitr adds `defineChannel`, schema validation, authentication and authorization, cache effects, the hooks, reconnection and the route extension.

## Problems it solves

- **Untyped messages.** [Define a channel](/packages/realtime/guide#define-a-channel).
- **Screens that do not update.** [Update the cache from events](/packages/realtime/guide#update-the-cache-from-events).
- **Anyone subscribing to anything.** [Authorize a subscription](/packages/realtime/guide#authorize-a-subscription).
- **Connection state nobody shows.** [Show the connection status](/packages/realtime/guide#show-the-connection-status).
- **Changing transport later.** [Transports](/packages/realtime/guide#transports).
- **Several server instances.** [Run more than one server instance](/packages/realtime/guide#run-more-than-one-server-instance).

## Further reading

- [Guide](/packages/realtime/guide).
- [API reference](/packages/realtime/api).
- [crossws](https://crossws.unjs.io) and [Socket.IO](https://socket.io/docs/v4/).
- [Query](/packages/query) and [Server](/packages/server).
- [Getting started](/docs/getting-started).
