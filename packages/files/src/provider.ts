import { defineProvider } from '@kitr/core'
import { createFiles, type FilesConfig } from './index'

/**
 * Binds `files` to the native dialog driver a platform package registered (`files` capability),
 * or the web driver. Nothing runs on the server beyond a no-op binding.
 */
export const filesProvider = defineProvider({
  name: 'files',
  register(app) {
    const config = app.config.get('files', {} as FilesConfig)
    app.container.singleton('files', () => createFiles(config, app))
  },
})

export default filesProvider
