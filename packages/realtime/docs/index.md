---
title: Realtime
description: Define a live channel once and push updates to every open screen, over WebSockets, Socket.IO or server events.
order: 1
---

# Realtime

A chat, a notification bell, a dashboard that updates by itself: all of them need the server to push to open screens. `kitr/realtime` gives you typed **channels** that work the same over three transports, chosen in `config/realtime.ts`: WebSockets (default), Socket.IO, or server-sent events.

## Install

```sh
kitr add realtime
```

This installs `@kitr/realtime` (and the [server](/packages/server) package if missing), writes `config/realtime.ts`, `app/channels/example.ts`, `server/realtime.ts`, attaches the realtime server in `server/main.ts`, and in React apps writes `app/realtime.ts` with the client connection.

## Define a channel once

```ts
// app/channels/chat.ts
import { defineChannel } from 'kitr/realtime'

export const chatChannel = defineChannel<{ room: string }>({
  name: 'chat',
  events: {
    message: { effects: (_m: Message, { room }) => ({ invalidate: [['messages', room]] }) },
  },
  authorize: (params, ctx) => !!ctx.user,
})
```

## Emit from the server

```ts
// server/controllers/messages_controller.ts
import { realtime } from '#server/realtime'

realtime.use(chatChannel, { room }).emit('message', message)
```

## Subscribe in a component

```tsx
import { useChannel } from 'kitr/realtime/react'
import { realtime } from '#app/realtime'

function Room({ room }: { room: string }) {
  useChannel(realtime(), chatChannel, { room })
  // events apply their `effects` to the query cache, so useQuery(['messages', room]) refreshes
}
```

`channel(transport, def).subscription()` is also a kitr `SubscriptionContract`, so `useSubscription()` from [query](/packages/query) works with it directly.

## Transports

| `transport` | Client | Server | Use when |
| --- | --- | --- | --- |
| `websocket` | partysocket (reconnecting) | crossws through h3 | The default. Two-way, low latency. |
| `socket.io` | socket.io-client | socket.io rooms, Redis adapter | Your infrastructure already speaks Socket.IO. |
| `sse` | EventSource plus a POST control channel | plain HTTP | Hosts without WebSocket support; one-way updates. |

The channel definitions, the server `emit()` and the hooks do not change between them.
