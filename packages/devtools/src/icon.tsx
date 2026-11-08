import {
  Alert02Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CommandIcon,
  ComputerPhoneSyncIcon,
  DashboardSquare01Icon,
  Database01Icon,
  HardDriveIcon,
  LockKeyIcon,
  Note01Icon,
  Route01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

export type { IconSvgElement }

/** Hugeicons in the stroke-rounded style, sized for the overlay's 12px type. */
export function Icon({ icon, size = 14 }: { icon: IconSvgElement; size?: number }) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={1.5}
      color="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    />
  )
}

// kitr-allow-module-state: lookup table built once at import, never mutated
export const icons = {
  close: Cancel01Icon,
  command: CommandIcon,
  collapsed: ArrowRight01Icon,
  expanded: ArrowDown01Icon,
}

/** Icons for the built-in panels; a contributed panel may register its own under `panelIcons[id]`. */
// kitr-allow-module-state: lookup table built once at import, never mutated
export const panelIcons: Record<string, IconSvgElement> = {
  app: DashboardSquare01Icon,
  router: Route01Icon,
  query: Database01Icon,
  auth: LockKeyIcon,
  storage: HardDriveIcon,
  platform: ComputerPhoneSyncIcon,
  errors: Alert02Icon,
  analytics: Analytics01Icon,
  log: Note01Icon,
}
