import { type ReactNode, type RefObject, useEffect, useRef } from 'react'
import { Icon, type IconSvgElement } from '../icon'
import { useEscapeLayer } from './layers'

export interface MenuItem {
  key: string
  label: string
  icon?: IconSvgElement
  danger?: boolean
  onSelect: () => void
}

/**
 * A popup list. On desktop it hangs off its positioned parent (or `style`); on phones it is a
 * bottom action sheet. Escape and a press outside close it; `ignore` is the anchor whose own
 * press toggles it, so closing and reopening do not fight.
 */
export function Menu({
  items,
  onClose,
  phone,
  style,
  ignore,
  label,
  footer,
}: {
  items: MenuItem[]
  onClose: () => void
  phone?: boolean
  style?: React.CSSProperties
  ignore?: RefObject<HTMLElement | null>
  label?: string
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEscapeLayer(onClose)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const path = e.composedPath()
      if (ref.current && path.includes(ref.current)) return
      if (ignore?.current && path.includes(ignore.current)) return
      onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [onClose, ignore])
  const where: React.CSSProperties = phone
    ? {
        position: 'fixed',
        left: 8,
        right: 8,
        bottom: 'calc(8px + env(safe-area-inset-bottom))',
        maxHeight: '60dvh',
        overflowY: 'auto',
        borderRadius: 12,
      }
    : { top: '100%', right: 0, marginTop: 4 }
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="kitr-dt-menu"
      style={{ ...where, ...style }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className="kitr-dt-menu-item"
          style={item.danger ? { color: 'var(--dt-error)' } : undefined}
          onClick={() => {
            onClose()
            item.onSelect()
          }}
        >
          {item.icon ? <Icon icon={item.icon} /> : null}
          {item.label}
        </button>
      ))}
      {footer}
    </div>
  )
}
