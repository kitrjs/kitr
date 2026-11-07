import type { DevtoolsHub } from '@kitr/core'
import type { AnalyticsAdapter } from './types'

/** Mirrors every analytics call into the devtools log (channel "analytics"). Development only. */
export function devtoolsAdapter(hub: DevtoolsHub): AnalyticsAdapter {
  return {
    name: 'devtools',
    page: (path, props) => hub.log('analytics', `page ${path}`, props),
    track: (event, props) => hub.log('analytics', `track ${event}`, props),
    identify: (userId, traits) => hub.log('analytics', `identify ${userId}`, traits),
    reset: () => hub.log('analytics', 'reset'),
  }
}
