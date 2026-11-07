import {
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Cancel01Icon,
  Copy01Icon,
  Delete02Icon,
  GithubIcon,
  LinkSquare02Icon,
  Menu01Icon,
  Moon02Icon,
  PencilEdit02Icon,
  RefreshIcon,
  Search01Icon,
  Sun03Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

export type { IconSvgElement }

/** Hugeicons in the stroke-rounded style: round caps, round joins, soft corners everywhere. */
export function Icon({
  icon,
  size = 18,
  stroke = 'currentColor',
  strokeWidth = 1.5,
  className,
}: {
  icon: IconSvgElement
  size?: number
  stroke?: string
  strokeWidth?: number
  className?: string
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color={stroke}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  )
}

export const icons = {
  search: Search01Icon,
  moon: Moon02Icon,
  sun: Sun03Icon,
  github: GithubIcon,
  copy: Copy01Icon,
  check: Tick02Icon,
  refresh: RefreshIcon,
  external: LinkSquare02Icon,
  trash: Delete02Icon,
  edit: PencilEdit02Icon,
  arrow: ArrowRight02Icon,
  menu: Menu01Icon,
  back: ArrowLeft02Icon,
  close: Cancel01Icon,
  chevronDown: ArrowDown01Icon,
}
