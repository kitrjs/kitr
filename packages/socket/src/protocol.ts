import type { CacheEffect, KitrErrorShape, StandardSchemaV1 } from '@kitr/core'

/** Wire protocol shared by the WebSocket and Socket.IO transports. */
export type ClientMessage =
  | { t: 'sub'; id: string; ch: string; p: unknown }
  | { t: 'unsub'; id: string }
  | { t: 'msg'; ch: string; p: unknown; ev: string; d: unknown }
  | { t: 'ping' }

export type ServerMessage =
  | { t: 'ev'; ch: string; p: unknown; ev: string; d: unknown }
  | { t: 'ok'; id: string }
  | { t: 'err'; id?: string; e: KitrErrorShape }
  | { t: 'pong' }

export interface ChannelEvent<TData = unknown, TParams = unknown> {
  /** Optional schema for the payload (validated on receive). */
  schema?: StandardSchemaV1<unknown, TData>
  /** What this event does to the query cache on the client. */
  effects?: (data: TData, params: TParams) => CacheEffect | void
}

export interface ChannelDefinition<
  TParams = void,
  TEvents extends Record<string, ChannelEvent<any, TParams>> = Record<
    string,
    ChannelEvent<any, TParams>
  >,
> {
  name: string
  params?: StandardSchemaV1<unknown, TParams>
  events: TEvents
  /** Server side: may this connection subscribe? `ctx` is what `authorize` on the server returned. */
  authorize?: (params: TParams, ctx: unknown) => boolean | Promise<boolean>
  /** Server side: handle a client-sent message on this channel. */
  onMessage?: (event: string, data: unknown, params: TParams, ctx: unknown) => void | Promise<void>
}

export type EventData<E> = E extends ChannelEvent<infer D, any> ? D : never
export type ChannelEventUnion<C extends ChannelDefinition<any, any>> = {
  [K in keyof C['events'] & string]: { event: K; data: EventData<C['events'][K]> }
}[keyof C['events'] & string]
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
 */
export function defineChannel<
  TParams = void,
  const TEvents extends Record<string, ChannelEvent<any, TParams>> = Record<
    string,
    ChannelEvent<any, TParams>
  >,
>(definition: ChannelDefinition<TParams, TEvents>): ChannelDefinition<TParams, TEvents> {
  return definition
}

/** Stable topic string for a channel + params. */
export function topicFor(channel: string, params: unknown): string {
  return `${channel}:${stableStringify(params ?? null)}`
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as object).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(',')}}`
}

export function parseMessage<T>(raw: unknown): T | null {
  try {
    if (typeof raw === 'string') return JSON.parse(raw) as T
    if (raw instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(raw)) as T
    if (typeof raw === 'object' && raw !== null) return raw as T
  } catch {}
  return null
}
