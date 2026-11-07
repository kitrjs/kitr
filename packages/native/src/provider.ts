import { defineProvider } from '@kitr/core'
import { createNative, type NativeConfig } from './index'

/**
 * Binds `native` from the drivers platform packages registered (`clipboard`, `share`, `haptics`,
 * `geolocation`, `camera`, `biometrics`) with web drivers for the rest.
 */
export const nativeProvider = defineProvider({
  name: 'native',
  register(app) {
    const config = app.config.get('native', {} as NativeConfig)
    app.container.singleton('native', () => createNative(config, app))
  },
})

export default nativeProvider
