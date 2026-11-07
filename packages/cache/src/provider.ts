import { defineProvider, getDevtools } from '@kitr/core'
import { type CacheConfig, createCache } from './index'

/** Binds `cache` from `config/cache.ts` (memory driver by default). */
export const cacheProvider = defineProvider({
  name: 'cache',
  register(app) {
    if (app.isClient) return
    const config = app.config.get('cache', {} as CacheConfig)
    app.container.singleton('cache', () => createCache(config))
  },
  boot(app) {
    if (app.isClient) return
    getDevtools(app)?.log('cache', `driver: ${app.container.use('cache').driver.name}`)
  },
})

export default cacheProvider
