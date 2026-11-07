import { createDefineConfig, defineProvider, type KitrApp, type KitrProvider } from '@kitr/core'

/**
 * kitr ships no ORM. `defineDb` binds whatever you use (Drizzle, Prisma, Kysely,
 * a raw pool) as `db` in the container with connect/disconnect in the lifecycle.
 *
 *   // config/db.ts
 *   export default defineDb({ connect: () => drizzle(process.env.DATABASE_URL!), disconnect: (db) => db.$client.end() })
 */
export interface DbDefinition<T> {
  connect: (app: KitrApp) => T | Promise<T>
  disconnect?: (db: T, app: KitrApp) => void | Promise<void>
  /** Run on `ready` (e.g. pending migrations check). */
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

export function defineDb<T>(definition: DbDefinition<T>): DbDefinition<T> {
  return definition
}

export const defineConfig = createDefineConfig<DbDefinition<any>>()

/** Binds `db` from `config/db.ts`. Connects on boot, disconnects on shutdown. */
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

/** Typed access: `const db = useDb<AppDb>(app)`. */
export function useDb<T>(app: KitrApp): T {
  return app.container.use('db') as T
}
