import type { DevtoolsAction, DevtoolsPanel, DevtoolsTone, KitrApp } from '@kitr/core'

/** Runs an action and logs the outcome under the `devtools` channel. */
export async function runAction(action: DevtoolsAction, app: KitrApp) {
  const hub = app.container.use('devtools')
  try {
    const result = await action.run(app)
    if (typeof result === 'string' && result) hub.log('devtools', result, undefined, 'info')
    else hub.log('devtools', `ran ${action.label}`, undefined, 'debug')
  } catch (e) {
    hub.log('devtools', `${action.label} failed`, e, 'error')
  }
}

/** The panel's actions that are currently visible; a throwing `when` hides the action. */
export function visibleActions(panel: DevtoolsPanel, app: KitrApp): DevtoolsAction[] {
  return (panel.actions ?? []).filter((a) => {
    try {
      return a.when ? a.when(app) : true
    } catch {
      return false
    }
  })
}

export interface TabBadge {
  value: string | number
  tone?: DevtoolsTone
}

/** Normalises `panel.badge` into one shape; empty values and a throwing badge give null. */
export function readBadge(panel: DevtoolsPanel, app: KitrApp): TabBadge | null {
  try {
    const b = panel.badge?.(app)
    if (b === null || b === undefined || b === 0 || b === '') return null
    if (typeof b === 'object') return b.value === 0 || b.value === '' ? null : b
    return { value: b }
  } catch {
    return null
  }
}
