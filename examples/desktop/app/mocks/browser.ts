import { setupBrowserMocks } from 'kitr/mocks'
import { handlers } from './handlers'

/**
 * `await enableMocks()` in the client entry. Env values are strings, so only `VITE_MOCKS=true`
 * turns mocks on (`false` would be truthy), and only in dev.
 */
export async function enableMocks() {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === 'true') await setupBrowserMocks(handlers)
}
