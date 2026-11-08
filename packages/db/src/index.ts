import { createDefineConfig, defineProvider, type KitrApp, type KitrProvider } from '@kitr/core'

/**
 * kitr ships no ORM. `defineDb` binds whatever you use (Drizzle, Prisma, Kysely,
 * a raw pool) as `db` in the container with connect/disconnect in the lifecycle.
 *
 *   // config/db.ts
 *   export default defineDb({ connect: () => drizzle(process.env.DATABASE_URL!), disconnect: (db) => db.$client.end() })
 */
export interface DbDefinition<T> {
  /** Opens the connection and returns the client. Runs once during `app.boot()`; a rejection fails boot. */
  connect: (app: KitrApp) => T | Promise<T>
  /** Closes the client when the server shuts down (SIGINT, SIGTERM or `server.close()`). */
  disconnect?: (db: T, app: KitrApp) => void | Promise<void>
  /** Runs once the server is ready to serve, after boot. Use it to check for pending migrations or warm a pool. */
  onReady?: (db: T, app: KitrApp) => void | Promise<void>
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    db: DbDefinition<any>
  }
  interface ContainerBindings {
    db: unknown
  }
}

/**
 * Declares how the app connects to its database, in `config/db.ts`. Returns the definition
 * unchanged; it exists so `disconnect` and `onReady` receive the client type `connect` returns.
 */
export function defineDb<T>(definition: DbDefinition<T>): DbDefinition<T> {
  return definition
}

/** Untyped alias of `defineDb` for the `defineConfig` convention; prefer `defineDb`, which infers the client type. */
export const defineConfig = createDefineConfig<DbDefinition<any>>()

/**
 * The provider `kitr add db` puts in `kitrrc.ts`. It binds `db` in the container from `config/db.ts`,
 * connects during boot, runs `onReady` when the server is ready and `disconnect` on shutdown.
 */
export const dbProvider: KitrProvider = defineProvider({
  name: 'db',
  register(app) {
    const def = app.config.get('db')
    app.container.singleton('db', () => def.connect(app))
  },
  async ready(app) {
    const def = app.config.get('db')
    await def.onReady?.(await app.container.make('db'), app)
  },
  async shutdown(app) {
    const def = app.config.get('db')
    if (app.container.has('db')) await def.disconnect?.(await app.container.make('db'), app)
  },
})

export default dbProvider

/**
 * Returns the connected client from an app's container, typed as `T`: `useDb<AppDb>(ctx.app)`.
 * Throws when the app has no `db` binding, or when an async `connect` has not finished (call it after `app.boot()`).
 */
export function useDb<T>(app: KitrApp): T {
  return app.container.use('db') as T
}
