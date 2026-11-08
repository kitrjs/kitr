---
title: API reference
description: Every export of @kitr/realtime, with its signature.
order: 2
---

# API reference

Every export of `@kitr/realtime`, `@kitr/realtime/client`, `@kitr/realtime/routes`, `@kitr/realtime/server`, `@kitr/realtime/socket.io`, `@kitr/realtime/socket.io/server`, `@kitr/realtime/sse`, `@kitr/realtime/sse/server`, `@kitr/realtime/react`, read from the published type definitions. The [guide](/packages/realtime/guide) shows them in use.

## @kitr/realtime

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
client from `@kitr/realtime/socket.io` so the dependency stays optional.

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

### defaultIdentity

```ts
const defaultIdentity: ConnectionIdentity;
```

The default `identify`: `userId`, `user.id` or `id` of the connection context.

### defineConfig

```ts
const defineConfig: <const C extends RealtimeConfig>(config: C) => C;
```

Typed identity helper for `config/realtime.ts`.

### ownedBy

```ts
const ownedBy: (identify: ConnectionIdentity | undefined, ctx: unknown, userId: string | number) => boolean;
```

Whether a connection with this context belongs to `userId`.

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
  /**
   * Server side: handle a client-sent message on this channel. `realtime` is the server that
   * received it, to emit back: `realtime.use(channel, params).emit('typing', data)`.
   */
  onMessage?: (event: string, data: unknown, params: TParams, ctx: unknown, realtime: RealtimeEmitter) => void | Promise<void>;
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
  /** A subscription contract for `useSubscription` (@kitr/query) or `subscriptionFrom`. */
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
  transport?: RealtimeTransport;
  /** Client URL. Default: same origin at `path`. */
  url?: string;
  /** Server path of the upgrade route (websocket), the SSE stream, or the Socket.IO path. Default `/ws`, `/events` for sse. Read by both `createRealtimeClient` and `createRealtimeServer`. */
  path?: string;
  /** WebSocket only: client ping interval in ms; a ping left unanswered by the next one reconnects. Default 25 000; 0 disables. */
  heartbeat?: number;
}
```

The shape of `config/realtime.ts`: which transport both ends use and where they meet.

### RealtimeEmitter

```ts
interface RealtimeEmitter {
  use(channel: ChannelDefinition<any, any>, params: any): {
    emit(event: any, data?: any): void;
  };
}
```

The least every realtime server (WebSocket, SSE, Socket.IO) offers a channel's `onMessage`.

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
  /**
   * Ping interval in ms while open. A connection that has not answered the previous ping by the
   * next one is treated as dead and reconnected. Default 25 000; 0 disables.
   */
  heartbeat?: number;
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

### ConnectionIdentity

```ts
type ConnectionIdentity = (ctx: unknown) => string | number | null | undefined;
```

Who a connection belongs to, for `closeSessions(userId)`. `identify` reads it from the context
`authorize` returned; the default takes `ctx.userId`, `ctx.user.id` or `ctx.id`, as a string.

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
type RealtimeTransportName = 'websocket' | 'socket.io' | 'sse';
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

## @kitr/realtime/client

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
  /** A subscription contract for `useSubscription` (@kitr/query) or `subscriptionFrom`. */
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
  /**
   * Ping interval in ms while open. A connection that has not answered the previous ping by the
   * next one is treated as dead and reconnected. Default 25 000; 0 disables.
   */
  heartbeat?: number;
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

## @kitr/realtime/routes

### ws

```ts
const ws: {
  readonly key: "ws";
  readonly kinds: readonly [
    "ws"
  ];
  readonly methods: {
    readonly ws: (this: AnyRouteTable, path: string, options: SocketServerOptions) => AnyRouteTable;
    readonly sse: (this: AnyRouteTable, path: string, options: SseServerOptions) => AnyRouteTable;
  };
  readonly targets: {
    readonly h3: (entries: RouteEntry[], server: KitrServer) => MountedSockets;
  };
};
```

The realtime extension: `.ws` and `.sse` on the route table, mounted by
`createServer({ routes })`. No React: safe in a pure backend.

```ts
import { defineRoutes } from '@kitr/kitr/app'
import ws from '@kitr/realtime/routes'
export const routes = defineRoutes([ws], (r) => r.ws('/ws', { channels: [chatChannel] }))
```

### SocketRouteType

```ts
interface SocketRouteType<Transport extends 'websocket' | 'sse' = 'websocket' | 'sse', Path extends string = string, C extends ChannelDefinition<any, any> = ChannelDefinition<any, any>> {
  kind: 'ws';
  transport: Transport;
  path: Path;
  /** The union of channel definitions served on this path. */
  channels: C;
}
```

The type carried per socket route into `$types`.

### SseRouteOptions

```ts
interface SseRouteOptions<C extends readonly ChannelDefinition<any, any>[]> extends Omit<SseServerOptions, 'channels'> {
  channels: C;
}
```

Options for `.sse(path, options)`: the channels, the stream authorizer and the keep-alive.

### WsRouteOptions

```ts
interface WsRouteOptions<C extends readonly ChannelDefinition<any, any>[]> extends Omit<SocketServerOptions, 'channels'> {
  channels: C;
}
```

Options for `.ws(path, options)`: the channels and the upgrade authorizer.

### MountedSockets

```ts
type MountedSockets = Record<string, SocketServer | SseServer>;
```

What the `h3` target returns: the realtime servers by path.

## @kitr/realtime/server

### createMemoryRealtimeAdapter

```ts
function createMemoryRealtimeAdapter(): RealtimeAdapter;
```

Every handler for every topic, in this process only. The default; right for one instance.

### createRealtimeServer

```ts
function createRealtimeServer(options: RealtimeServerOptions): RealtimeServer;
```

Creates the realtime server for the transport in `config/realtime.ts`, so switching transports
there changes both ends. Pass the config straight in:

```ts
import realtimeConfig from '../config/realtime'
export const realtime = createRealtimeServer({ ...realtimeConfig, channels: [chatChannel] })
realtime.attach(server) // at realtimeConfig.path
```
Socket.IO needs a Socket.IO `Server`, so it throws here: use `attachSocketIo` from
`@kitr/realtime/socket.io/server` instead.

### createRedisRealtimeAdapter

```ts
function createRedisRealtimeAdapter(redis: RedisPubSubClient, options?: RedisRealtimeAdapterOptions): RealtimeAdapter;
```

A realtime adapter over Redis pub/sub, so an `emit` on any instance reaches the clients on
every instance. Pass an ioredis client; the adapter opens one more connection for subscribing.

```ts
const adapter = createRedisRealtimeAdapter(new Redis(process.env.REDIS_URL)) // Redis from ioredis
r.ws('/ws', { channels: [projectChannel], adapter })
```
Each instance subscribes only to the topics its own clients listen on, so traffic grows with
what is watched, not with the number of instances.

### createSocketServer

```ts
function createSocketServer(options: SocketServerOptions): SocketServer;
```

Creates the native WebSocket server on crossws (via h3). Runs on Node, Bun, Deno and Cloudflare.
Attach it to a kitr server with `attach(server, path)`; emit with `use(channel, params).emit()`.

### realtimeProvider

```ts
function realtimeProvider(options: RealtimeServerOptions): KitrProvider;
```

A provider that binds the realtime server as `realtime` in the container, for the transport and
path in `config/realtime.ts` (options given here win). It does not register the route, because
the provider has no server: call `app.container.use('realtime').attach(server)` after boot.

### ChannelEmitter

```ts
interface ChannelEmitter<C extends ChannelDefinition<any, any>> {
  /** Send an event to every connection subscribed to this topic, on every instance the adapter reaches. A topic with no subscribers is a no-op. */
  emit<E extends keyof C['events'] & string>(event: E, data: C['events'][E] extends {
    schema: infer S;
  } ? S extends {
    '~standard': {
      types?: {
        output: infer O;
      };
    };
  } ? O : unknown : unknown): void;
  /** Subscriber count for this topic on this instance. */
  readonly size: number;
}
```

Publishes events to every subscriber of one channel topic, as `server.use(channel, params)` returns it.

### RealtimeAdapter

```ts
interface RealtimeAdapter {
  /** Shown in logs, e.g. `memory` or `redis`. */
  readonly name: string;
  /**
   * Start receiving messages published on `topic`, in this process. Several handlers may listen
   * to one topic; the adapter subscribes upstream once and fans out. Returns (or resolves with,
   * once the upstream subscription is live) the function that removes this handler again.
   */
  subscribe(topic: string, handler: (payload: string) => void): (() => void) | Promise<() => void>;
  /**
   * Deliver `payload` to every handler of `topic` on every instance, this one included.
   * Resolves with the number of receivers when the backend reports it (Redis counts subscribed
   * connections, the memory adapter counts local handlers), so `0` means nobody is listening.
   */
  publish(topic: string, payload: string): number | Promise<number>;
  /** Close the adapter's connections. Called by you on shutdown, never by the server. */
  close?(): Promise<void>;
}
```

How realtime servers on several instances reach each other. Each server keeps its own
connections; the adapter carries a published message to every instance that has a subscriber
for its topic, and each instance writes it to its own connections.

The memory adapter (the default) only reaches this process. `createRedisRealtimeAdapter`
reaches every process connected to the same Redis.

### RealtimeServer

```ts
interface RealtimeServer {
  /** Which transport this server speaks. */
  readonly transport: Exclude<RealtimeTransport, 'socket.io'>;
  /** Publish on a channel from an action, controller or job. */
  use<C extends ChannelDefinition<any, any>>(channel: C, params: ChannelParams<C>): ChannelEmitter<C>;
  /** Register the route on a kitr server: at `path`, else the `path` option, else `/ws` (websocket) or `/events` (sse). */
  attach(server: KitrServer, path?: string): RealtimeServer;
  /** Number of open connections or streams. */
  readonly connections: number;
  /**
   * Close every connection or stream of `userId` on this instance and return how many. Call it when
   * the user's access ends (sign-out everywhere, password reset, a ban); see `SocketServer.closeSessions`.
   */
  closeSessions(userId: string | number): number;
}
```

The realtime server for whichever transport `config/realtime.ts` names: websocket or sse.

### RealtimeServerOptions

```ts
interface RealtimeServerOptions extends SocketServerOptions, RealtimeConfig {
  /** SSE only: keep-alive comment interval in ms. Default 20 000. */
  keepAlive?: number;
}
```

Options for `createRealtimeServer`: the channels, plus the transport and path from `config/realtime.ts`.

### RedisPubSubClient

```ts
interface RedisPubSubClient {
  /** `PUBLISH`: resolves with the number of subscribed connections that received it. */
  publish(channel: string, message: string): Promise<number>;
  /** `SUBSCRIBE`; puts the connection into subscriber mode. */
  subscribe(...channels: string[]): Promise<unknown>;
  /** `UNSUBSCRIBE`. */
  unsubscribe(...channels: string[]): Promise<unknown>;
  /** ioredis emits `message` with the channel and the payload. */
  on(event: 'message', listener: (channel: string, message: string) => void): unknown;
  /** A second connection with the same options, for subscriber mode. */
  duplicate(): RedisPubSubClient;
  /** ioredis: `'ready'` once connected and past its ready check. */
  status?: string;
  /** ioredis emits `ready` when the connection can take commands. */
  once?(event: 'ready', listener: () => void): unknown;
  /** Close the connection. */
  quit(): Promise<unknown>;
}
```

The part of an [ioredis](https://github.com/redis/ioredis) client the realtime adapter uses.
An ioredis `Redis` or `Cluster` fits as it is.

### RedisRealtimeAdapterOptions

```ts
interface RedisRealtimeAdapterOptions {
  /**
   * The connection that subscribes. A Redis connection in subscriber mode can run no other
   * command, so it must not be the one you pass first. Default: `redis.duplicate()`.
   */
  subscriber?: RedisPubSubClient;
  /** Prepended to every Redis channel, so apps sharing a Redis stay apart. Default `kitr:rt:`. */
  prefix?: string;
  /** Called when Redis rejects a publish or subscribe. Default: `console.error`. */
  onError?: (error: unknown) => void;
}
```

Options for `createRedisRealtimeAdapter`.

### SocketServer

```ts
interface SocketServer {
  /** The h3 handler for the upgrade route: `server.h3.get('/ws', socket.handler)`. */
  handler: ReturnType<typeof defineWebSocketHandler>;
  /** Publish on a channel from an action, controller or job. */
  use<C extends ChannelDefinition<any, any>>(channel: C, params: ChannelParams<C>): ChannelEmitter<C>;
  /** Attach to a kitr server: registers the route and enables the upgrade. */
  attach(server: KitrServer, path?: string): SocketServer;
  /** Number of open connections on this instance. */
  readonly connections: number;
  /**
   * Close every connection of `userId` on this instance (code 4401, reason `Session revoked`) and
   * return how many. Call it when the user's access ends: sign-out everywhere, a password reset, a
   * ban. Authorisation happens when a connection opens and when it subscribes, so without this a
   * revoked session keeps receiving events until its socket drops. Other instances are not reached:
   * call it on each, or from a handler every instance runs.
   */
  closeSessions(userId: string | number): number;
  /** The adapter emits travel through. */
  readonly adapter: RealtimeAdapter;
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
  /**
   * Who a connection belongs to, read from the context `authorize` returned, so
   * `closeSessions(userId)` can find it. Default: the context's `userId`, `user.id` or `id`.
   */
  identify?: ConnectionIdentity;
  /**
   * Carries emits between server instances. Default: the memory adapter, which only reaches
   * clients connected to this process. Use `createRedisRealtimeAdapter` when you run more than one.
   */
  adapter?: RealtimeAdapter;
}
```

Options for `createSocketServer`: the channels it serves and how it authenticates connections.

## @kitr/realtime/socket.io

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

Creates the same `SocketTransport` as

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

## @kitr/realtime/socket.io/server

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
  /** Disconnect every socket of `userId` on this instance and return how many; see `SocketServer.closeSessions`. */
  closeSessions(userId: string | number): number;
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
  /** Who a socket belongs to, for `closeSessions(userId)`. Default: the context's `userId`, `user.id` or `id`. */
  identify?: ConnectionIdentity;
  /** Serve channels on this Socket.IO namespace instead of the default `/`. */
  namespace?: string;
}
```

Options for `attachSocketIo`: the channels to serve, connection auth and an optional namespace.

## @kitr/realtime/sse

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

## @kitr/realtime/sse/server

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

A provider that binds an SSE realtime server as `realtime` in the container. It does not attach the route.

### SseServer

```ts
interface SseServer {
  /** GET opens the stream, POST carries sub/unsub/msg control messages. Mount both on one path. */
  handler: ReturnType<typeof defineHandler>;
  /** Publish on a channel from an action, controller or job. */
  use<C extends ChannelDefinition<any, any>>(channel: C, params: ChannelParams<C>): ChannelEmitter<C>;
  /** Register GET and POST on `path` (default `/events`) of a kitr server. */
  attach(server: KitrServer, path?: string): SseServer;
  /** Number of open streams on this instance. */
  readonly connections: number;
  /** Close every stream of `userId` on this instance and return how many; see `SocketServer.closeSessions`. A client that reconnects is authorised again. */
  closeSessions(userId: string | number): number;
  /** The adapter emits and forwarded control messages travel through. */
  readonly adapter: RealtimeAdapter;
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
  /** Who a stream belongs to, for `closeSessions(userId)`. Default: the context's `userId`, `user.id` or `id`. */
  identify?: ConnectionIdentity;
  /** Keep-alive comment interval in ms. Default 20 000. */
  keepAlive?: number;
  /**
   * Carries emits, and control POSTs that land on another instance than their stream, between
   * server instances. Default: the memory adapter (this process only). Use
   * `createRedisRealtimeAdapter` when you run more than one.
   */
  adapter?: RealtimeAdapter;
}
```

Options for `createSseServer`: the channels to serve, stream auth and the keep-alive interval.

## @kitr/realtime/react

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
