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

A transport from `config/realtime.ts`: websocket (default) or sse here; socket.io loads its
client from `kitr/realtime/socket.io` so the dependency stays optional.

```ts
let transport: SocketTransport | undefined
export const realtime = () => (transport ??= createRealtimeClient(realtimeConfig))
```

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

### parseMessage

```ts
function parseMessage<T>(raw: unknown): T | null;
```

### stableStringify

```ts
function stableStringify(value: unknown): string;
```

### topicFor

```ts
function topicFor(channel: string, params: unknown): string;
```

Stable topic string for a channel + params.

### createWebSocketTransport

```ts
const createWebSocketTransport: typeof createSocketClient;
```

The native WebSocket transport (same as `createSocketClient`).

### defineConfig

```ts
const defineConfig: <const C extends RealtimeConfig>(config: C) => C;
```

### ChannelDefinition

```ts
interface ChannelDefinition<TParams = void, TEvents extends Record<string, ChannelEvent<any, TParams>> = Record<string, ChannelEvent<any, TParams>>> {
  name: string;
  params?: StandardSchemaV1<unknown, TParams>;
  events: TEvents;
  /** Server side: may this connection subscribe? `ctx` is what `authorize` on the server returned. */
  authorize?: (params: TParams, ctx: unknown) => boolean | Promise<boolean>;
  /** Server side: handle a client-sent message on this channel. */
  onMessage?: (event: string, data: unknown, params: TParams, ctx: unknown) => void | Promise<void>;
}
```

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

### ChannelHandle

```ts
interface ChannelHandle<C extends ChannelDefinition<any, any>> {
  /** A subscription contract for `useSubscription` (kitr/query) or `defineSubscription`. */
  subscription(): SubscriptionContract<ChannelParams<C>, ChannelEventUnion<C>>;
  /** Send a client event up the channel. */
  send<E extends keyof C['events'] & string>(params: ChannelParams<C>, event: E, data: unknown): void;
  key(params: ChannelParams<C>): QueryKey;
}
```

### RealtimeConfig

```ts
interface RealtimeConfig {
  /** `websocket` (default, crossws/partysocket), `socket.io` (rooms, adapters) or `sse` (one-way events over HTTP, any host). */
  transport?: RealtimeTransport$1;
  /** Client URL. Default: same origin at `path`. */
  url?: string;
  /** Server path of the upgrade route (websocket), the SSE stream, or the Socket.IO path. Default `/ws`, `/events` for sse. */
  path?: string;
  /** Heartbeat interval in ms (client pings). Default 25 000; 0 disables. */
  heartbeat?: number;
}
```

### SocketClientOptions

```ts
interface SocketClientOptions {
  /** `ws://` or `wss://` URL, or a function (e.g. to append a token). */
  url: string | (() => string | Promise<string>);
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

### SocketTransport

```ts
interface SocketTransport {
  subscribe(channel: string, params: unknown, onEvent: (event: string, data: unknown) => void, onError?: (e: KitrErrorShape) => void): () => void;
  send(channel: string, params: unknown, event: string, data: unknown): void;
  close(): void;
  readonly status: SocketStatus;
  onStatus(listener: (status: SocketStatus) => void): () => void;
}
```

### SseTransportOptions

```ts
interface SseTransportOptions {
  /** The stream URL (`/events`). Control messages are POSTed to the same URL. */
  url: string | (() => string);
  /** Extra headers for control requests (the stream itself cannot carry headers; use cookies or a `?token=`). */
  headers?: Record<string, string> | (() => Record<string, string>);
  onError?: (error: KitrErrorShape) => void;
}
```

### ChannelEventUnion

```ts
type ChannelEventUnion<C extends ChannelDefinition<any, any>> = {
  [K in keyof C['events'] & string]: {
    event: K;
    data: EventData<C['events'][K]>;
  };
}[keyof C['events'] & string];
```

### ChannelParams

```ts
type ChannelParams<C> = C extends ChannelDefinition<infer P, any> ? P : never;
```

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

Wire protocol shared by the WebSocket and Socket.IO transports.

### EventData

```ts
type EventData<E> = E extends ChannelEvent<infer D, any> ? D : never;
```

### RealtimeStatus

```ts
type RealtimeStatus = SocketStatus;
```

### RealtimeTransport

```ts
type RealtimeTransport = SocketTransport;
```

Alias: the transport interface every realtime client implements.

### RealtimeTransportName

```ts
type RealtimeTransport$1 = 'websocket' | 'socket.io' | 'sse';
```

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

### SocketStatus

```ts
type SocketStatus = 'connecting' | 'open' | 'closed';
```

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
  /** A subscription contract for `useSubscription` (kitr/query) or `defineSubscription`. */
  subscription(): SubscriptionContract<ChannelParams<C>, ChannelEventUnion<C>>;
  /** Send a client event up the channel. */
  send<E extends keyof C['events'] & string>(params: ChannelParams<C>, event: E, data: unknown): void;
  key(params: ChannelParams<C>): QueryKey;
}
```

### SocketClientOptions

```ts
interface SocketClientOptions {
  /** `ws://` or `wss://` URL, or a function (e.g. to append a token). */
  url: string | (() => string | Promise<string>);
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

### SocketTransport

```ts
interface SocketTransport {
  subscribe(channel: string, params: unknown, onEvent: (event: string, data: unknown) => void, onError?: (e: KitrErrorShape) => void): () => void;
  send(channel: string, params: unknown, event: string, data: unknown): void;
  close(): void;
  readonly status: SocketStatus;
  onStatus(listener: (status: SocketStatus) => void): () => void;
}
```

### RealtimeStatus

```ts
type RealtimeStatus = SocketStatus;
```

### RealtimeTransport

```ts
type RealtimeTransport = SocketTransport;
```

Alias: the transport interface every realtime client implements.

### SocketStatus

```ts
type SocketStatus = 'connecting' | 'open' | 'closed';
```

## kitr/realtime/server

### createSocketServer

```ts
function createSocketServer(options: SocketServerOptions): SocketServer;
```

Native WebSocket server on crossws (via h3). Runs on Node, Bun, Deno and Cloudflare.

### realtimeProvider

```ts
function realtimeProvider(options: SocketServerOptions & {
  path?: string;
}): KitrProvider;
```

Provider: binds `realtime` (the WebSocket server) in the container.

### createRealtimeServer

```ts
const createRealtimeServer: typeof createSocketServer;
```

The WebSocket server, under the transport-neutral name.

### ChannelEmitter

```ts
interface ChannelEmitter<C extends ChannelDefinition<any, any>> {
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

### SocketServer

```ts
interface SocketServer {
  /** The h3 handler for the upgrade route: `server.h3.get('/ws', socket.handler)`. */
  handler: ReturnType<typeof defineWebSocketHandler>;
  /** Publish on a channel from an action, controller or job. */
  use<C extends ChannelDefinition<any, any>>(channel: C, params: ChannelParams<C>): ChannelEmitter<C>;
  /** Attach to a kitr server: registers the route and enables the upgrade. */
  attach(server: KitrServer, path?: string): SocketServer;
  readonly connections: number;
}
```

### SocketServerOptions

```ts
interface SocketServerOptions {
  channels: ChannelDefinition<any, any>[];
  /** Authenticate the upgrade. Return per-connection context (e.g. the user) or throw/return false to reject. */
  authorize?: (request: Request) => unknown | Promise<unknown>;
}
```

### RealtimeServer

```ts
type RealtimeServer = SocketServer;
```

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

The same `SocketTransport` as kitr/realtime, over Socket.IO. Use it with `channel()`
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

### SocketIoClientOptions

```ts
interface SocketIoClientOptions extends Partial<ManagerOptions & SocketOptions> {
  url?: string;
  onError?: (error: KitrErrorShape) => void;
}
```

## kitr/realtime/socket.io/server

### attachSocketIo

```ts
function attachSocketIo(io: Server, options: SocketIoServerOptions): SocketIoServer;
```

Serve kitr channels over a Socket.IO server. Rooms are channel topics, so the
Redis adapter and sticky sessions work as they do for any Socket.IO app.

```ts
const io = new Server(nodeServer)
const sockets = attachSocketIo(io, { channels: [projectChannel] })
sockets.use(projectChannel, { id }).emit('updated', project)
```

### SocketIoServer

```ts
interface SocketIoServer {
  io: Server;
  use<C extends ChannelDefinition<any, any>>(channel: C, params: ChannelParams<C>): {
    emit(event: keyof C['events'] & string, data: unknown): void;
  };
}
```

### SocketIoServerOptions

```ts
interface SocketIoServerOptions {
  channels: ChannelDefinition<any, any>[];
  /** Authenticate a connection (`socket.handshake.auth`). Return context or throw. */
  authorize?: (socket: Socket) => unknown | Promise<unknown>;
  namespace?: string;
}
```

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
  onError?: (error: KitrErrorShape) => void;
}
```

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

Provider: binds `realtime` (the SSE server) in the container.

### SseServer

```ts
interface SseServer {
  /** GET opens the stream, POST carries sub/unsub/msg control messages. Mount both on one path. */
  handler: ReturnType<typeof defineHandler>;
  use<C extends ChannelDefinition<any, any>>(channel: C, params: ChannelParams<C>): ChannelEmitter<C>;
  attach(server: KitrServer, path?: string): SseServer;
  readonly connections: number;
}
```

### SseServerOptions

```ts
interface SseServerOptions {
  channels: ChannelDefinition<any, any>[];
  /** Authenticate the stream request. Return per-connection context or throw/return false to reject. */
  authorize?: (request: Request) => unknown | Promise<unknown>;
  /** Keep-alive comment interval in ms. Default 20 000. */
  keepAlive?: number;
}
```

## kitr/realtime/react

### useChannel

```ts
function useChannel<C extends ChannelDefinition<any, any>>(transport: SocketTransport, definition: C, params: ChannelParams<C>, options?: UseSubscriptionOptions<ChannelEventUnion<C>>): {
  status: "idle" | "open" | "error";
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
