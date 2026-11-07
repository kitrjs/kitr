import { defineProvider } from '@kitr/core'
import type { UploadsConfig } from './index'

/**
 * Binds `uploads` on the server from `config/uploads.ts`. The server module is loaded at boot so
 * the browser bundle of this provider never resolves node:fs.
 */
export const uploadsProvider = defineProvider({
  name: 'uploads',
  async boot(app) {
    if (app.isClient) return
    const config = app.config.get('uploads', {} as UploadsConfig)
    const { createUploads } = await import('./server')
    app.container.singleton('uploads', () => createUploads(config))
  },
})

export default uploadsProvider
