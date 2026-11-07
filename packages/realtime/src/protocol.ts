import type { CacheEffect, KitrErrorShape, StandardSchemaV1 } from '@kitr/core'

/**
 * A frame the client sends: subscribe (`sub`), unsubscribe (`unsub`), a client event (`msg`) or a `ping`.
 * The wire protocol shared by the WebSocket, Socket.IO and SSE transports.
 */
export type ClientMessage =
  | { t: 'sub'; id: string; ch: string; p: unknown }
  | { t: 'unsub'; id: string }
  | { t: 'msg'; ch: string; p: unknown; ev: string; d: unknown }
  | { t: 'ping' }

/** A frame the server sends: an event (`ev`), a subscription ack (`ok`), an error (`err`) or a `pong`. */
export type ServerMessage =
  | { t: 'ev'; ch: string; p: unknown; ev: string; d: unknown }
  /** `p` is the params after the channel's schema ran; events are routed by them. */
  | { t: 'ok'; id: string; p?: unknown }
  | { t: 'err'; id?: string; e: KitrErrorShape }
  | { t: 'pong' }

/** One event a channel carries: an optional payload schema and the cache effects it applies on the client. */
export interface ChannelEvent<TData = unknown, TParams = unknown> {
  /** Optional schema for the payload (validated on receive). */
  schema?: StandardSchemaV1<unknown, TData>
  /**
   * What this event does to the query cache on the client. Method syntax on purpose: a channel
   * without a payload schema can still annotate `data` (`effects(message: Message) {...}`).
   */
  effects?(data: TData, params: TParams): CacheEffect | void
}

/** A channel as `defineChannel` returns it: its name, params schema, events and server-side hooks. */
export interface ChannelDefinition<
  TParams = void,
  TEvents extends Record<string, ChannelEvent<any, TParams>> = Record<
    string,
    ChannelEvent<any, TParams>
  >,
> {
  /** Unique channel name; it is the first part of every topic and must match on both ends. */
  name: string
  /** Schema for the subscription params. The server validates (and may transform) them before `authorize`. */
  params?: StandardSchemaV1<unknown, TParams>
  /** The events this channel carries, by name. */
  events: TEvents
  /** Server side: may this connection subscribe? `ctx` is what `authorize` on the server returned. */
  authorize?: (params: TParams, ctx: unknown) => boolean | Promise<boolean>
  /** Server side: handle a client-sent message on this channel. */
  onMessage?: (event: string, data: unknown, params: TParams, ctx: unknown) => void | Promise<void>
}

/** The payload type of one channel event, inferred from its `schema` or `effects` annotation. */
export type EventData<E> = E extends ChannelEvent<infer D, any> ? D : never
/** Every event of a channel as a `{ event, data }` union, which `useChannel` returns as `lastEvent`. */
export type ChannelEventUnion<C extends ChannelDefinition<any, any>> = {
  [K in keyof C['events'] & string]: { event: K; data: EventData<C['events'][K]> }
}[keyof C['events'] & string]
/** The params type a channel subscribes with. */
export type ChannelParams<C> = C extends ChannelDefinition<infer P, any> ? P : never

/**
 * One channel definition serves both ends: the client applies `effects` to the
 * cache, the server checks `authorize`. Switching WebSocket ⇄ Socket.IO is a config change.
 *
 *   export const projectChannel = defineChannel({
 *     name: 'projects',
 *     params: z.object({ id: z.string() }),
 *     events: {
 *       updated: { effects: (project, { id }) => ({ set: [{ key: ['projects', 'detail', id], data: project }] }) },
 *       deleted: { effects: () => ({ invalidate: [['projects', 'list']] }) },
 *     },
 *   })
 *
 * Import the same definition on the server (to serve and emit) and on the client (to subscribe).
 */
export function defineChannel<
  TParams = void,
  const TData extends Record<string, unknown> = Record<string, unknown>,
>(
  definition: Omit<ChannelDefinition<TParams, any>, 'events'> & {
    // Mapped per event, so each `effects` gets the payload type of its own `schema`.
    events: { [K in keyof TData]: ChannelEvent<TData[K], TParams> }
  },
): ChannelDefinition<TParams, { [K in keyof TData]: ChannelEvent<TData[K], TParams> }> {
  return definition as ChannelDefinition<
    TParams,
    { [K in keyof TData]: ChannelEvent<TData[K], TParams> }
  >
}

/** The topic string for a channel and params (`chat:{"room":"general"}`); key order in params does not matter. */
export function topicFor(channel: string, params: unknown): string {
  return `${channel}:${stableStringify(params ?? null)}`
}

/** `JSON.stringify` with object keys sorted, so equal params always produce the same topic. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as object).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(',')}}`
}

/** Parses a frame from a string, an ArrayBuffer or an object; returns `null` for anything that is not valid JSON. */
export function parseMessage<T>(raw: unknown): T | null {
  try {
    if (typeof raw === 'string') return JSON.parse(raw) as T
    if (raw instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(raw)) as T
    if (typeof raw === 'object' && raw !== null) return raw as T
  } catch {}
  return null
}
