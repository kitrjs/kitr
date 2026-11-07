---
title: API
description: Every export of kitr/realtime, with its signature.
order: 2
---

# API

Every export of `kitr/realtime`, `kitr/realtime/client`, `kitr/realtime/server`, `kitr/realtime/socket.io`, `kitr/realtime/socket.io/server`, `kitr/realtime/sse`, `kitr/realtime/sse/server`, `kitr/realtime/react`, read from the published type definitions. The [guide](/packages/realtime) shows them in use.

## kitr/realtime

### channel

```ts
function channel<C extends ChannelDefinition<any, any>>(transport: SocketTransport, definition: C): ChannelHandle<C>;
```

Bind a channel definition to a transport. Events validated by their schema
(when given) are handed to `effects`, which `useSubscription` applies to the cache.

### createRealtimeClient

```ts
function createRealtimeClient(config?: RealtimeConfig): SocketTransport;
```

Creates the client transport `config/realtime.ts` names: websocket (default) or sse here; socket.io loads its
client from `kitr/realtime/socket.io` so the dependency stays optional.

```ts
let transport: SocketTransport | undefined
export const realtime = () => (transport ??= createRealtimeClient(realtimeConfig))
```
Call it lazily, as above, so nothing connects during SSR.

### createSocketClient

```ts
function createSocketClient(options: SocketClientOptions): SocketTransport;
```

The native WebSocket transport (partysocket underneath: reconnects, buffers
while offline). Subscriptions are re-sent after every reconnect.

### createSseTransport

```ts
function createSseTransport(options: SseTransportOptions): SocketTransport;
```

Server-Sent Events as a realtime transport: the server pushes over one `EventSource`,
the client subscribes and sends with plain `fetch` POSTs. Works through any HTTP host
and proxy, no upgrade needed. Same channels, same `useSubscription`.

### defineChannel

```ts
function defineChannel<TParams = void, const TData extends Record<string, unknown> = Record<string, unknown>>(definition: Omit<ChannelDefinition<TParams, any>, 'events'> & {
  events: {
    [K in keyof TData]: ChannelEvent<TData[K], TParams>;
  };
}): ChannelDefinition<TParams, {
  [K in keyof TData]: ChannelEvent<TData[K], TParams>;
}>;
```

One channel definition serves both ends: the client applies `effects` to the
cache, the server checks `authorize`. Switching WebSocket ⇄ Socket.IO is a config change.

```ts
export const projectChannel = defineChannel({
  name: 'projects',
  params: z.object({ id: z.string() }),
  events: {
    updated: { effects: (project, { id }) => ({ set: [{ key: ['projects', 'detail', id], data: project }] }) },
    deleted: { effects: () => ({ invalidate: [['projects', 'list']] }) },
  },
})
```
Import the same definition on the server (to serve and emit) and on the client (to subscribe).

### parseMessage

```ts
function parseMessage<T>(raw: unknown): T | null;
```

Parses a frame from a string, an ArrayBuffer or an object; returns `null` for anything that is not valid JSON.

### stableStringify

```ts
function stableStringify(value: unknown): string;
```

`JSON.stringify` with object keys sorted, so equal params always produce the same topic.

### topicFor

```ts
function topicFor(channel: string, params: unknown): string;
```

The topic string for a channel and params (`chat:{"room":"general"}`); key order in params does not matter.

### createWebSocketTransport

```ts
const createWebSocketTransport: typeof createSocketClient;
```

The native WebSocket transport (same as `createSocketClient`).

### defineConfig

```ts
const defineConfig: <const C extends RealtimeConfig>(config: C) => C;
```

Typed identity helper for `config/realtime.ts`.

### ChannelDefinition

```ts
interface ChannelDefinition<TParams = void, TEvents extends Record<string, ChannelEvent<any, TParams>> = Record<string, ChannelEvent<any, TParams>>> {
  /** Unique channel name; it is the first part of every topic and must match on both ends. */
  name: string;
  /** Schema for the subscription params. The server validates (and may transform) them before `authorize`. */
  params?: StandardSchemaV1<unknown, TParams>;
  /** The events this channel carries, by name. */
  events: TEvents;
  /** Server side: may this connection subscribe? `ctx` is what `authorize` on the server returned. */
  authorize?: (params: TParams, ctx: unknown) => boolean | Promise<boolean>;
  /** Server side: handle a client-sent message on this channel. */
  onMessage?: (event: string, data: unknown, params: TParams, ctx: unknown) => void | Promise<void>;
}
```

A channel as `defineChannel` returns it: its name, params schema, events and server-side hooks.

### ChannelEvent

```ts
interface ChannelEvent<TData = unknown, TParams = unknown> {
  /** Optional schema for the payload (validated on receive). */
  schema?: StandardSchemaV1<unknown, TData>;
  /**
   * What this event does to the query cache on the client. Method syntax on purpose: a channel
   * without a payload schema can still annotate `data` (`effects(message: Message) {...}`).
   */
  effects?(data: TData, params: TParams): CacheEffect | void;
}
```

One event a channel carries: an optional payload schema and the cache effects it applies on the client.

### ChannelHandle

```ts
interface ChannelHandle<C extends ChannelDefinition<any, any>> {
  /** A subscription contract for `useSubscription` (kitr/query) or `subscriptionFrom`. */
  subscription(): SubscriptionContract<ChannelParams<C>, ChannelEventUnion<C>>;
  /** Send a client event up the channel. */
  send<E extends keyof C['events'] & string>(params: ChannelParams<C>, event: E, data: unknown): void;
  /** The query key of a subscription: `['realtime', name, params]`. */
  key(params: ChannelParams<C>): QueryKey;
}
```

A channel bound to a transport, as `channel()` returns it.

### RealtimeConfig

```ts
interface RealtimeConfig {
  /** `websocket` (default, crossws/partysocket), `socket.io` (rooms, adapters) or `sse` (one-way events over HTTP, any host). */
  transport?: RealtimeTransport$1;
  /** Client URL. Default: same origin at `path`. */
  url?: string;
  /** Server path of the upgrade route (websocket), the SSE stream, or the Socket.IO path. Default `/ws`, `/events` for sse. */
  path?: string;
  /** Heartbeat interval in ms (client pings). Default 25 000; 0 disables. Not read by the built-in clients yet. */
  heartbeat?: number;
}
```

The shape of `config/realtime.ts`: which transport the client uses and where it connects.

### SocketClientOptions

```ts
interface SocketClientOptions {
  /** `ws://` or `wss://` URL, or a function (e.g. to append a token). */
  url: string | (() => string | Promise<string>);
  /** WebSocket subprotocols, passed to the WebSocket constructor. */
  protocols?: string | string[];
  /** Reconnect settings passed to partysocket. */
  reconnect?: {
    maxRetries?: number;
    minReconnectionDelay?: number;
    maxReconnectionDelay?: number;
  };
  /** Called for every server error that isn't tied to a subscription. */
  onError?: (error: KitrErrorShape) => void;
}
```

Options for `createSocketClient`, the native WebSocket transport.

### SocketTransport

```ts
interface SocketTransport {
  /** Subscribe to a channel topic. Returns a function that unsubscribes. */
  subscribe(channel: string, params: unknown, onEvent: (event: string, data: unknown) => void, onError?: (e: KitrErrorShape) => void): () => void;
  /** Send a client event up a channel; the server hands it to the channel's `onMessage`. */
  send(channel: string, params: unknown, event: string, data: unknown): void;
  /** Close the connection and stop reconnecting. */
  close(): void;
  /** The current connection state. */
  readonly status: SocketStatus;
  /** Listen for status changes. Returns a function that removes the listener. */
  onStatus(listener: (status: SocketStatus) => void): () => void;
}
```

What every realtime client implements: WebSocket, Socket.IO, SSE, or your own.
`channel()` and `useChannel()` only talk to this interface.

### SseTransportOptions

```ts
interface SseTransportOptions {
  /** The stream URL (`/events`). Control messages are POSTed to the same URL. */
  url: string | (() => string);
  /** Extra headers for control requests (the stream itself cannot carry headers; use cookies or a `?token=`). */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** Called for server errors not tied to a subscription, and for failed control requests (`NETWORK`). */
  onError?: (error: KitrErrorShape) => void;
}
```

Options for `createSseTransport`, the Server-Sent Events client.

### ChannelEventUnion

```ts
type ChannelEventUnion<C extends ChannelDefinition<any, any>> = {
  [K in keyof C['events'] & string]: {
    event: K;
    data: EventData<C['events'][K]>;
  };
}[keyof C['events'] & string];
```

Every event of a channel as a `{ event, data }` union, which `useChannel` returns as `lastEvent`.

### ChannelParams

```ts
type ChannelParams<C> = C extends ChannelDefinition<infer P, any> ? P : never;
```

The params type a channel subscribes with.

### ClientMessage

```ts
type ClientMessage = {
  t: 'sub';
  id: string;
  ch: string;
  p: unknown;
} | {
  t: 'unsub';
  id: string;
} | {
  t: 'msg';
  ch: string;
  p: unknown;
  ev: string;
  d: unknown;
} | {
  t: 'ping';
};
```

A frame the client sends: subscribe (`sub`), unsubscribe (`unsub`), a client event (`msg`) or a `ping`.
The wire protocol shared by the WebSocket, Socket.IO and SSE transports.

### EventData

```ts
type EventData<E> = E extends ChannelEvent<infer D, any> ? D : never;
```

The payload type of one channel event, inferred from its `schema` or `effects` annotation.

### RealtimeStatus

```ts
type RealtimeStatus = SocketStatus;
```

Alias of `SocketStatus`.

### RealtimeTransport

```ts
type RealtimeTransport = SocketTransport;
```

Alias: the transport interface every realtime client implements.

### RealtimeTransportName

```ts
type RealtimeTransport$1 = 'websocket' | 'socket.io' | 'sse';
```

Which transport carries channel traffic: native WebSocket, Socket.IO, or Server-Sent Events.

### ServerMessage

```ts
type ServerMessage = {
  t: 'ev';
  ch: string;
  p: unknown;
  ev: string;
  d: unknown;
} | 
/** `p` is the params after the channel's schema ran; events are routed by them. */
{
  t: 'ok';
  id: string;
  p?: unknown;
} | {
  t: 'err';
  id?: string;
  e: KitrErrorShape;
} | {
  t: 'pong';
};
```

A frame the server sends: an event (`ev`), a subscription ack (`ok`), an error (`err`) or a `pong`.

### SocketStatus

```ts
type SocketStatus = 'connecting' | 'open' | 'closed';
```

The connection state a transport reports: connecting, open or closed.

## kitr/realtime/client

### channel

```ts
function channel<C extends ChannelDefinition<any, any>>(transport: SocketTransport, definition: C): ChannelHandle<C>;
```

Bind a channel definition to a transport. Events validated by their schema
(when given) are handed to `effects`, which `useSubscription` applies to the cache.

### createSocketClient

```ts
function createSocketClient(options: SocketClientOptions): SocketTransport;
```

The native WebSocket transport (partysocket underneath: reconnects, buffers
while offline). Subscriptions are re-sent after every reconnect.

### createWebSocketTransport

```ts
const createWebSocketTransport: typeof createSocketClient;
```

The native WebSocket transport (same as `createSocketClient`).

### ChannelHandle

```ts
interface ChannelHandle<C extends ChannelDefinition<any, any>> {
  /** A subscription contract for `useSubscription` (kitr/query) or `subscriptionFrom`. */
  subscription(): SubscriptionContract<ChannelParams<C>, ChannelEventUnion<C>>;
  /** Send a client event up the channel. */
  send<E extends keyof C['events'] & string>(params: ChannelParams<C>, event: E, data: unknown): void;
  /** The query key of a subscription: `['realtime', name, params]`. */
  key(params: ChannelParams<C>): QueryKey;
}
```

A channel bound to a transport, as `channel()` returns it.

### SocketClientOptions

```ts
interface SocketClientOptions {
  /** `ws://` or `wss://` URL, or a function (e.g. to append a token). */
  url: string | (() => string | Promise<string>);
  /** WebSocket subprotocols, passed to the WebSocket constructor. */
  protocols?: string | string[];
  /** Reconnect settings passed to partysocket. */
  reconnect?: {
    maxRetries?: number;
    minReconnectionDelay?: number;
    maxReconnectionDelay?: number;
  };
  /** Called for every server error that isn't tied to a subscription. */
  onError?: (error: KitrErrorShape) => void;
}
```

Options for `createSocketClient`, the native WebSocket transport.

### SocketTransport

```ts
interface SocketTransport {
  /** Subscribe to a channel topic. Returns a function that unsubscribes. */
  subscribe(channel: string, params: unknown, onEvent: (event: string, data: unknown) => void, onError?: (e: KitrErrorShape) => void): () => void;
  /** Send a client event up a channel; the server hands it to the channel's `onMessage`. */
  send(channel: string, params: unknown, event: string, data: unknown): void;
  /** Close the connection and stop reconnecting. */
  close(): void;
  /** The current connection state. */
  readonly status: SocketStatus;
  /** Listen for status changes. Returns a function that removes the listener. */
  onStatus(listener: (status: SocketStatus) => void): () => void;
}
```

What every realtime client implements: WebSocket, Socket.IO, SSE, or your own.
`channel()` and `useChannel()` only talk to this interface.

### RealtimeStatus

```ts
type RealtimeStatus = SocketStatus;
```

Alias of `SocketStatus`.

### RealtimeTransport

```ts
type RealtimeTransport = SocketTransport;
```

Alias: the transport interface every realtime client implements.

### SocketStatus

```ts
type SocketStatus = 'connecting' | 'open' | 'closed';
```

The connection state a transport reports: connecting, open or closed.

## kitr/realtime/server

### createSocketServer

```ts
function createSocketServer(options: SocketServerOptions): SocketServer;
```

Creates the native WebSocket server on crossws (via h3). Runs on Node, Bun, Deno and Cloudflare.
Attach it to a kitr server with `attach(server, path)`; emit with `use(channel, params).emit()`.

### realtimeProvider

```ts
function realtimeProvider(options: SocketServerOptions & {
  path?: string;
}): KitrProvider;
```

A provider that binds a WebSocket server as `realtime` in the container. It does not attach the
route: call `attach()` on the bound server yourself. `path` is accepted but not used.

### createRealtimeServer

```ts
const createRealtimeServer: typeof createSocketServer;
```

The WebSocket server factory under its transport-neutral name; same as `createSocketServer`.

### ChannelEmitter

```ts
interface ChannelEmitter<C extends ChannelDefinition<any, any>> {
  /** Send an event to every connection subscribed to this topic. A topic with no subscribers is a no-op. */
  emit<E extends keyof C['events'] & string>(event: E, data: C['events'][E] extends {
    schema: infer S;
  } ? S extends {
    '~standard': {
      types?: {
        output: infer O;
      };
    };
  } ? O : unknown : unknown): void;
  /** Subscriber count for this topic. */
  readonly size: number;
}
```

Publishes events to every subscriber of one channel topic, as `server.use(channel, params)` returns it.

### SocketServer

```ts
interface SocketServer {
  /** The h3 handler for the upgrade route: `server.h3.get('/ws', socket.handler)`. */
  handler: ReturnType<typeof defineWebSocketHandler>;
  /** Publish on a channel from an action, controller or job. */
  use<C extends ChannelDefinition<any, any>>(channel: C, params: ChannelParams<C>): ChannelEmitter<C>;
  /** Attach to a kitr server: registers the route and enables the upgrade. */
  attach(server: KitrServer, path?: string): SocketServer;
  /** Number of open connections. */
  readonly connections: number;
}
```

The realtime server for the native WebSocket transport, as `createRealtimeServer` returns it.

### SocketServerOptions

```ts
interface SocketServerOptions {
  /** Every channel clients may subscribe to. Subscribing to any other name fails with `NOT_FOUND`. */
  channels: ChannelDefinition<any, any>[];
  /** Authenticate the upgrade. Return per-connection context (e.g. the user) or throw/return false to reject. */
  authorize?: (request: Request) => unknown | Promise<unknown>;
}
```

Options for `createSocketServer`: the channels it serves and how it authenticates connections.

### RealtimeServer

```ts
type RealtimeServer = SocketServer;
```

Alias of `SocketServer`.

## kitr/realtime/socket.io

### channel

```ts
function channel<C extends ChannelDefinition<any, any>>(transport: SocketTransport, definition: C): ChannelHandle<C>;
```

Bind a channel definition to a transport. Events validated by their schema
(when given) are handed to `effects`, which `useSubscription` applies to the cache.

### createSocketIoClient

```ts
function createSocketIoClient(options?: SocketIoClientOptions): SocketTransport & {
  socket: Socket;
};
```

Creates the same `SocketTransport` as kitr/realtime, over Socket.IO; `.socket` is the raw socket.io-client socket. Use it with `channel()`
from kitr/realtime/socket.io; the channel definitions and `useSubscription` don't change.

### defineChannel

```ts
function defineChannel<TParams = void, const TData extends Record<string, unknown> = Record<string, unknown>>(definition: Omit<ChannelDefinition<TParams, any>, 'events'> & {
  events: {
    [K in keyof TData]: ChannelEvent<TData[K], TParams>;
  };
}): ChannelDefinition<TParams, {
  [K in keyof TData]: ChannelEvent<TData[K], TParams>;
}>;
```

One channel definition serves both ends: the client applies `effects` to the
cache, the server checks `authorize`. Switching WebSocket ⇄ Socket.IO is a config change.

```ts
export const projectChannel = defineChannel({
  name: 'projects',
  params: z.object({ id: z.string() }),
  events: {
    updated: { effects: (project, { id }) => ({ set: [{ key: ['projects', 'detail', id], data: project }] }) },
    deleted: { effects: () => ({ invalidate: [['projects', 'list']] }) },
  },
})
```
Import the same definition on the server (to serve and emit) and on the client (to subscribe).

### SocketIoClientOptions

```ts
interface SocketIoClientOptions extends Partial<ManagerOptions & SocketOptions> {
  /** Server URL. Default: the page's origin. */
  url?: string;
  /** Called for every server error that isn't tied to a subscription. */
  onError?: (error: KitrErrorShape) => void;
}
```

Options for `createSocketIoClient`: any socket.io-client option plus the server URL and an error handler.

## kitr/realtime/socket.io/server

### attachSocketIo

```ts
function attachSocketIo(io: Server, options: SocketIoServerOptions): SocketIoServer;
```

Serves kitr channels over an existing Socket.IO server. Rooms are channel topics, so the
Redis adapter and sticky sessions work as they do for any Socket.IO app.

```ts
const io = new Server(nodeServer)
const sockets = attachSocketIo(io, { channels: [projectChannel] })
sockets.use(projectChannel, { id }).emit('updated', project)
```
Connections are authenticated once in a namespace middleware; each subscription runs the channel's `authorize`.

### SocketIoServer

```ts
interface SocketIoServer {
  /** The Socket.IO server you passed in. */
  io: Server;
  /** Publish on a channel topic: `use(channel, params).emit(event, data)` emits to that topic's room. */
  use<C extends ChannelDefinition<any, any>>(channel: C, params: ChannelParams<C>): {
    emit(event: keyof C['events'] & string, data: unknown): void;
  };
}
```

Channels served over Socket.IO, as `attachSocketIo` returns them.

### SocketIoServerOptions

```ts
interface SocketIoServerOptions {
  /** Every channel clients may subscribe to. */
  channels: ChannelDefinition<any, any>[];
  /** Authenticate a connection (`socket.handshake.auth`). Return context or throw. */
  authorize?: (socket: Socket) => unknown | Promise<unknown>;
  /** Serve channels on this Socket.IO namespace instead of the default `/`. */
  namespace?: string;
}
```

Options for `attachSocketIo`: the channels to serve, connection auth and an optional namespace.

## kitr/realtime/sse

### createSseTransport

```ts
function createSseTransport(options: SseTransportOptions): SocketTransport;
```

Server-Sent Events as a realtime transport: the server pushes over one `EventSource`,
the client subscribes and sends with plain `fetch` POSTs. Works through any HTTP host
and proxy, no upgrade needed. Same channels, same `useSubscription`.

### SseTransportOptions

```ts
interface SseTransportOptions {
  /** The stream URL (`/events`). Control messages are POSTed to the same URL. */
  url: string | (() => string);
  /** Extra headers for control requests (the stream itself cannot carry headers; use cookies or a `?token=`). */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** Called for server errors not tied to a subscription, and for failed control requests (`NETWORK`). */
  onError?: (error: KitrErrorShape) => void;
}
```

Options for `createSseTransport`, the Server-Sent Events client.

## kitr/realtime/sse/server

### createSseServer

```ts
function createSseServer(options: SseServerOptions): SseServer;
```

Realtime channels over Server-Sent Events: one streaming GET per client, control messages
over POST. Runs anywhere h3 runs, including hosts without WebSocket upgrades.

### sseProvider

```ts
function sseProvider(options: SseServerOptions): KitrProvider;
```

A provider that binds an SSE server as `realtime` in the container. It does not attach the route.

### SseServer

```ts
interface SseServer {
  /** GET opens the stream, POST carries sub/unsub/msg control messages. Mount both on one path. */
  handler: ReturnType<typeof defineHandler>;
  /** Publish on a channel from an action, controller or job. */
  use<C extends ChannelDefinition<any, any>>(channel: C, params: ChannelParams<C>): ChannelEmitter<C>;
  /** Register GET and POST on `path` (default `/events`) of a kitr server. */
  attach(server: KitrServer, path?: string): SseServer;
  /** Number of open streams. */
  readonly connections: number;
}
```

The realtime server for the SSE transport, as `createSseServer` returns it.

### SseServerOptions

```ts
interface SseServerOptions {
  /** Every channel clients may subscribe to. */
  channels: ChannelDefinition<any, any>[];
  /** Authenticate the stream request. Return per-connection context or throw/return false to reject. */
  authorize?: (request: Request) => unknown | Promise<unknown>;
  /** Keep-alive comment interval in ms. Default 20 000. */
  keepAlive?: number;
}
```

Options for `createSseServer`: the channels to serve, stream auth and the keep-alive interval.

## kitr/realtime/react

### useChannel

```ts
function useChannel<C extends ChannelDefinition<any, any>>(transport: SocketTransport, definition: C, params: ChannelParams<C>, options?: UseSubscriptionOptions<ChannelEventUnion<C>>): {
  status: "error" | "idle" | "open";
  lastEvent: ChannelEventUnion<C> | undefined;
  error: import("@kitr/core").KitrErrorShape | undefined;
};
```

Subscribe a component to a channel: `useChannel(realtime(), chatChannel, { room })`.
Events run the channel's cache `effects`; the hook also returns the last event and status.

### useRealtimeStatus

```ts
function useRealtimeStatus(transport: SocketTransport | undefined): SocketStatus;
```

`'connecting' | 'open' | 'closed'` for a connection indicator.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
