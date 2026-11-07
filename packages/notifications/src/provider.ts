import { defineProvider } from '@kitr/core'
import { createNotifications, type NotificationsConfig } from './index'

/**
 * Binds `notifications` to the platform driver (`notifications` capability) or the web
 * Notification API. With `requestOnBoot` it asks for permission as the app starts.
 */
export const notificationsProvider = defineProvider({
  name: 'notifications',
  register(app) {
    const config = app.config.get('notifications', {} as NotificationsConfig)
    app.container.singleton('notifications', () => createNotifications(config, app))
  },
  async boot(app) {
    if (!app.isClient) return
    const config = app.config.get('notifications', {} as NotificationsConfig)
    if (config.requestOnBoot) await app.container.use('notifications').request()
  },
})

export default notificationsProvider
