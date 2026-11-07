import type { EventMap } from 'kitr/analytics'

/** Every event the app sends, with its props. `useAnalytics<AppEvents>()` checks names and props. */
export interface AppEvents extends EventMap {
  'sign-in.completed': { method: 'password' | 'oauth' }
  'project.created': { id: string }
}
