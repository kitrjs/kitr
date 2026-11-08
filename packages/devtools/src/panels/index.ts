import type { DevtoolsPanel } from '@kitr/core'
import { appPanel } from './app'
import { logPanel } from './log'
import { routerPanel } from './router'

export { useHub } from '../hooks'

/** Panels every kitr app has: the app itself, the router and the event log. */
export function builtinPanels(): DevtoolsPanel[] {
  return [appPanel(), routerPanel(), logPanel()]
}
