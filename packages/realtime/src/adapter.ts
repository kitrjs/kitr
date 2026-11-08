/**
 * How realtime servers on several instances reach each other. Each server keeps its own
 * connections; the adapter carries a published message to every instance that has a subscriber
 * for its topic, and each instance writes it to its own connections.
 *
 * The memory adapter (the default) only reaches this process. `createRedisRealtimeAdapter`
 * reaches every process connected to the same Redis.
 */
export interface RealtimeAdapter {
  /** Shown in logs, e.g. `memory` or `redis`. */
  readonly name: string
  /**
   * Start receiving messages published on `topic`, in this process. Several handlers may listen
   * to one topic; the adapter subscribes upstream once and fans out. Returns (or resolves with,
   * once the upstream subscription is live) the function that removes this handler again.
   */
  subscribe(topic: string, handler: (payload: string) => void): (() => void) | Promise<() => void>
  /**
   * Deliver `payload` to every handler of `topic` on every instance, this one included.
   * Resolves with the number of receivers when the backend reports it (Redis counts subscribed
   * connections, the memory adapter counts local handlers), so `0` means nobody is listening.
   */
  publish(topic: string, payload: string): number | Promise<number>
  /** Close the adapter's connections. Called by you on shutdown, never by the server. */
  close?(): Promise<void>
}

/** Every handler for every topic, in this process only. The default; right for one instance. */
export function createMemoryRealtimeAdapter(): RealtimeAdapter {
  const handlers = new Map<string, Set<(payload: string) => void>>()
  return {
    name: 'memory',
    subscribe(topic, handler) {
      let set = handlers.get(topic)
      if (!set) {
        set = new Set()
        handlers.set(topic, set)
      }
      set.add(handler)
      return () => {
        const current = handlers.get(topic)
        if (!current) return
        current.delete(handler)
        if (current.size === 0) handlers.delete(topic)
      }
    },
    publish(topic, payload) {
      const set = handlers.get(topic)
      if (!set) return 0
      for (const handler of [...set]) handler(payload)
      return set.size
    },
  }
}

/**
 * The part of an [ioredis](https://github.com/redis/ioredis) client the realtime adapter uses.
 * An ioredis `Redis` or `Cluster` fits as it is.
 */
export interface RedisPubSubClient {
  /** `PUBLISH`: resolves with the number of subscribed connections that received it. */
  publish(channel: string, message: string): Promise<number>
  /** `SUBSCRIBE`; puts the connection into subscriber mode. */
  subscribe(...channels: string[]): Promise<unknown>
  /** `UNSUBSCRIBE`. */
  unsubscribe(...channels: string[]): Promise<unknown>
  /** ioredis emits `message` with the channel and the payload. */
  on(event: 'message', listener: (channel: string, message: string) => void): unknown
  /** A second connection with the same options, for subscriber mode. */
  duplicate(): RedisPubSubClient
  /** Close the connection. */
  quit(): Promise<unknown>
}

/** Options for `createRedisRealtimeAdapter`. */
export interface RedisRealtimeAdapterOptions {
  /**
   * The connection that subscribes. A Redis connection in subscriber mode can run no other
   * command, so it must not be the one you pass first. Default: `redis.duplicate()`.
   */
  subscriber?: RedisPubSubClient
  /** Prepended to every Redis channel, so apps sharing a Redis stay apart. Default `kitr:rt:`. */
  prefix?: string
  /** Called when Redis rejects a publish or subscribe. Default: `console.error`. */
  onError?: (error: unknown) => void
}

/**
 * A realtime adapter over Redis pub/sub, so an `emit` on any instance reaches the clients on
 * every instance. Pass an ioredis client; the adapter opens one more connection for subscribing.
 *
 *   const adapter = createRedisRealtimeAdapter(new Redis(process.env.REDIS_URL)) // Redis from ioredis
 *   r.ws('/ws', { channels: [projectChannel], adapter })
 *
 * Each instance subscribes only to the topics its own clients listen on, so traffic grows with
 * what is watched, not with the number of instances.
 */
export function createRedisRealtimeAdapter(
  redis: RedisPubSubClient,
  options: RedisRealtimeAdapterOptions = {},
): RealtimeAdapter {
  const prefix = options.prefix ?? 'kitr:rt:'
  const report = options.onError ?? ((error) => console.error('[kitr/realtime] redis', error))
  const subscriber = options.subscriber ?? redis.duplicate()
  const local = createMemoryRealtimeAdapter()
  const counts = new Map<string, number>()
  const ready = new Map<string, Promise<void>>()

  subscriber.on('message', (channel, message) => {
    if (!channel.startsWith(prefix)) return
    local.publish(channel.slice(prefix.length), message)
  })

  return {
    name: 'redis',
    async subscribe(topic, handler) {
      const off = local.subscribe(topic, handler) as () => void
      const count = (counts.get(topic) ?? 0) + 1
      counts.set(topic, count)
      if (count === 1)
        ready.set(
          topic,
          subscriber.subscribe(prefix + topic).then(() => undefined, report),
        )
      // The caller confirms the subscription to its client after this resolves, so an event
      // published right after the confirmation is not lost to a SUBSCRIBE still in flight.
      await ready.get(topic)
      let done = false
      return () => {
        if (done) return
        done = true
        off()
        const left = (counts.get(topic) ?? 1) - 1
        if (left > 0) {
          counts.set(topic, left)
          return
        }
        counts.delete(topic)
        ready.delete(topic)
        subscriber.unsubscribe(prefix + topic).catch(report)
      }
    },
    publish(topic, payload) {
      return redis.publish(prefix + topic, payload)
    },
    async close() {
      await Promise.allSettled([subscriber.quit(), redis.quit()])
    },
  }
}

/**
 * The topics one realtime server's connections listen on, over an adapter: joins subscribe the
 * adapter on a topic's first local listener and unsubscribe it after the last one leaves.
 * Shared by the WebSocket and SSE servers.
 */
export interface TopicRouter<Conn> {
  /** Add a connection to a topic; resolves once messages for the topic can arrive. */
  join(conn: Conn, topic: string): Promise<void>
  /** Remove a connection from a topic. */
  leave(conn: Conn, topic: string): void
  /** Connections on this instance listening on the topic. */
  size(topic: string): number
  /** Publish through the adapter; reports a rejected publish instead of throwing. */
  publish(topic: string, payload: string): void
}

/** Build the topic router a realtime server delivers through. Internal to the transports. */
export function createTopicRouter<Conn>(
  adapter: RealtimeAdapter,
  deliver: (conn: Conn, payload: string) => void,
  onError: (error: unknown) => void = (error) => console.error('[kitr/realtime]', error),
): TopicRouter<Conn> {
  const topics = new Map<string, { conns: Set<Conn>; off: Promise<(() => void) | undefined> }>()
  return {
    async join(conn, topic) {
      let entry = topics.get(topic)
      if (!entry) {
        const conns = new Set<Conn>()
        const off = Promise.resolve()
          .then(() =>
            adapter.subscribe(topic, (payload) => {
              for (const c of [...conns]) deliver(c, payload)
            }),
          )
          .catch((error) => {
            onError(error)
            return undefined
          })
        entry = { conns, off }
        topics.set(topic, entry)
      }
      entry.conns.add(conn)
      await entry.off
    },
    leave(conn, topic) {
      const entry = topics.get(topic)
      if (!entry) return
      entry.conns.delete(conn)
      if (entry.conns.size > 0) return
      topics.delete(topic)
      void entry.off.then((off) => off?.())
    },
    size(topic) {
      return topics.get(topic)?.conns.size ?? 0
    },
    publish(topic, payload) {
      try {
        const sent = adapter.publish(topic, payload)
        if (sent instanceof Promise) sent.catch(onError)
      } catch (error) {
        onError(error)
      }
    },
  }
}
