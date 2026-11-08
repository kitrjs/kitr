import type { DevtoolsPanel } from '@kitr/core'
import { isValidElement, type ReactNode } from 'react'
import { Icon, type IconSvgElement, panelIcons } from '../icon'

/** A hugeicons element is an array of path tuples; anything else is a React node. */
export function isIconElement(value: unknown): value is IconSvgElement {
  return Array.isArray(value)
}

/** Renders `icon` whether it is a hugeicons element or a React node. */
export function renderIcon(icon: unknown, size?: number): ReactNode {
  if (isIconElement(icon)) return <Icon icon={icon} size={size} />
  if (isValidElement(icon) || typeof icon === 'string' || typeof icon === 'number') return icon
  return null
}

/** The panel's own icon, else the built-in one for its id. */
export function panelIcon(panel: DevtoolsPanel, size?: number): ReactNode {
  const own = renderIcon(panel.icon, size)
  if (own) return own
  const builtin = panelIcons[panel.id]
  if (builtin) return <Icon icon={builtin} size={size} />
  // A contributed panel without an icon gets its initial, so tabs and palette rows stay aligned.
  return (
    <span className="kitr-dt-letter" aria-hidden="true">
      {panel.label.trim().charAt(0).toUpperCase()}
    </span>
  )
}
