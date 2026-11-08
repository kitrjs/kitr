import { HugeiconsIcon, type HugeiconsIconProps, type IconSvgElement } from '@hugeicons/react'
import { cn } from '@kitr/tailwind'

export type { IconSvgElement }

export interface IconProps extends Omit<HugeiconsIconProps, 'icon' | 'size' | 'color'> {
  /** Any icon from `@hugeicons/core-free-icons` (the stroke-rounded set). */
  icon: IconSvgElement
  /** Pixel size; icons scale with the surrounding text when left out. */
  size?: number | string
  /** Hidden from assistive tech unless a `label` is given. */
  label?: string
}

/**
 * The app's icon: Hugeicons in the stroke-rounded style, so every icon has round caps,
 * round joins and soft corners. `currentColor` by default, 1.5 stroke, sized to the text.
 *
 *   import { Add01Icon } from '@hugeicons/core-free-icons'
 *   <Icon icon={Add01Icon} />
 */
export function Icon({
  icon,
  size = '1.25em',
  strokeWidth = 1.5,
  label,
  className,
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
      color="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block shrink-0 align-[-0.2em]', className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      {...props}
    />
  )
}
