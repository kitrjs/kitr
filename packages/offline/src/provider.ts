import { defineProvider } from '@kitr/core'
import { bindOnlineManager, createOffline, type OfflineConfig } from './index'

/**
 * Persists the query cache and paused mutations, restores them before the first render and
 * replays the mutations when the network returns (TanStack Query resumes paused mutations on
 * its own once `onlineManager` says online). Put it after the query provider in kitrrc.ts.
 */
export const offlineProvider = defineProvider({
  name: 'offline',
  register(app) {
    if (!app.isClient) return
    const config = app.config.get('offline', {} as OfflineConfig)
    app.container.singleton('offline', () =>
      createOffline(app.container.use('queryClient'), config, app),
    )
  },
  async boot(app) {
    if (!app.isClient) return
    if (app.container.has('platform'))
      bindOnlineManager(app.container.use('platform') as Parameters<typeof bindOnlineManager>[0])
    await app.container.use('offline').restore()
  },
})

export default offlineProvider
