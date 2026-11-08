---
title: Overview
description: Define a live channel once and push updates to every open screen, over WebSockets, Socket.IO or server events.
order: 0
---

# Realtime

A chat, a notification bell, a project board that updates while you look at it: all of them need the server to push to screens that are already open. Raw WebSockets give you a pipe and nothing else: no typed events, no authorisation per channel, no connection to the data the screens already hold, and a rewrite if you move from one transport to another.

`@kitr/realtime` lets you define a typed channel once, emit on it from the server, and have every subscribed screen update its cache, on any of three transports.

## What it is

`@kitr/realtime` is built around channels. `defineChannel` declares a channel's params and its events with schemas. The server half (`@kitr/realtime/server`) accepts connections, authenticates them, authorises each subscription and emits events. The client half (`@kitr/realtime` and `@kitr/realtime/react`) subscribes with `useChannel` or through a [query](/packages/query) subscription, and each event's `effects` update the cache so components re-render with the new data. `useRealtimeStatus` drives a connection indicator.

It runs on both sides. For one-off server calls that return a value, use [actions](/packages/actions) or [API routes](/packages/api) instead; realtime is for events the server sends when something changes.

## Built on

| Transport | Built on | Use it for |
| --- | --- | --- |
| WebSockets (default) | [crossws](https://crossws.unjs.io) on the [h3](https://h3.dev) server | Most apps, on Node, Bun, Deno and Workers. |
| Socket.IO | [Socket.IO](https://socket.io/docs/v4/) | Existing Socket.IO clients, rooms and its reconnection behaviour. |
| Server-Sent Events | The browser's `EventSource` | Hosts that block WebSockets, or one-way updates. |

The channel code is the same on all three. kitr adds `defineChannel`, params and payload validation with [Standard Schema](https://standardschema.dev), authentication and per-channel authorisation, the cache effects, the React hooks, [PartySocket](https://github.com/partykit/partykit/tree/main/packages/partysocket) reconnection on the WebSocket client, and a route extension so sockets sit in the same route table as pages and endpoints.

## Problems it solves

- **Untyped messages.** A channel declares its events and payloads; emitting the wrong shape is a type error and a bad payload is rejected. See [Define a channel](/packages/realtime/guide#define-a-channel).
- **Screens that do not update.** Events carry cache effects, so the query cache changes and components follow. See [Update the cache from events](/packages/realtime/guide#update-the-cache-from-events).
- **Anyone subscribing to anything.** Authenticate the connection and authorise each subscription against the user. See [Authorize a subscription](/packages/realtime/guide#authorize-a-subscription).
- **Connection state nobody shows.** `useRealtimeStatus` for a banner or a dot. See [Show the connection status](/packages/realtime/guide#show-the-connection-status).
- **Changing transport later.** Swap WebSockets for Socket.IO or SSE in config; channels stay as they are. See [Transports](/packages/realtime/guide#transports).
- **Several server instances.** Fan events out across instances. See [Run more than one server instance](/packages/realtime/guide#run-more-than-one-server-instance).

## Further reading

- [Guide](/packages/realtime/guide): install, configure and every task.
- [API reference](/packages/realtime/api): every export of the seven entry points.
- [crossws](https://crossws.unjs.io) and [Socket.IO](https://socket.io/docs/v4/): the libraries underneath.
- [Query](/packages/query) and [Server](/packages/server): the cache effects write to, and the server connections attach to.
- [Getting started](/docs/getting-started): the `realtime` kit, a chat room built on these pieces.
