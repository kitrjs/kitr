import { setupBrowserMocks } from 'kitr/mocks'
import { handlers } from './handlers'

/** Call from main.tsx in dev: `if (import.meta.env.DEV && import.meta.env.VITE_MOCKS) await enableMocks()` */
export const enableMocks = () => setupBrowserMocks(handlers)
