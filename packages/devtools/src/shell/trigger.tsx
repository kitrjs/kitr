import { useEffect, useRef, useState } from 'react'
import { icons, MarkColor } from '../icon'
import { Menu } from './menu'
import type { Insets } from './use-layout'

export interface TriggerPos {
  edge: 'left' | 'right'
  y: number
}

const MARGIN = 12
const DRAG_SLOP = 4
const LONG_PRESS_MS = 500

/** Keeps the button inside the viewport, clear of the notch and the home indicator. */
export function clampY(y: number, size: number, insets: Insets): number {
  const min = MARGIN + insets.top
  const max = Math.max(min, window.innerHeight - size - MARGIN - insets.bottom)
  return Math.min(max, Math.max(min, y))
}

/** Where `position` puts the button before it has been dragged. */
export function startPos(position: string, size: number, insets: Insets): TriggerPos {
  const edge = position.endsWith('right') ? 'right' : 'left'
  const y = position.startsWith('top') ? 0 : window.innerHeight
  return { edge, y: clampY(y, size, insets) }
}

/**
 * The round button that opens the window. Drag it anywhere (a move under 4px is a click); on
 * release it snaps to the nearest side edge. A long press offers Hide and Reset position.
 */
export function Trigger({
  mode,
  phone,
  pos,
  insets,
  count,
  buttonRef,
  onOpen,
  onMove,
  onHide,
  onReset,
}: {
  mode: 'auto' | 'hover'
  phone: boolean
  pos: TriggerPos
  insets: Insets
  count: number
  buttonRef: (el: HTMLButtonElement | null) => void
  onOpen: () => void
  onMove: (pos: TriggerPos) => void
  onHide: () => void
  onReset: () => void
}) {
  const size = phone ? 44 : 36
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [menu, setMenu] = useState(false)
  const [near, setNear] = useState(false)
  const gesture = useRef({ id: -1, sx: 0, sy: 0, ox: 0, oy: 0, moved: false, swallow: false })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearTimer = () => clearTimeout(timer.current)
  useEffect(() => () => clearTimeout(timer.current), [])

  const tab = mode === 'hover' && !near && !drag && !menu
  const x = drag ? drag.x : pos.edge === 'left' ? MARGIN + insets.left : null
  const y = drag ? drag.y : pos.y
  const style: React.CSSProperties = {
    margin: 0,
    top: y,
    left: x ?? undefined,
    right: x === null ? MARGIN + insets.right : undefined,
    width: tab ? 6 : size,
    height: tab ? 40 : size,
    ...(tab ? { borderRadius: 3, overflow: 'hidden', opacity: 0.8, color: 'transparent' } : null),
  }
  if (tab) {
    // The edge tab hugs the screen edge instead of floating 12px off it.
    if (pos.edge === 'left') style.left = 0
    else style.right = 0
  }

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    gesture.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: rect.left,
      oy: rect.top,
      moved: false,
      swallow: false,
    }
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {}
    clearTimer()
    timer.current = setTimeout(() => {
      if (gesture.current.moved) return
      gesture.current.swallow = true
      setMenu(true)
    }, LONG_PRESS_MS)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current
    if (g.id !== e.pointerId) return
    const dx = e.clientX - g.sx
    const dy = e.clientY - g.sy
    if (!g.moved && Math.hypot(dx, dy) < DRAG_SLOP) return
    g.moved = true
    clearTimer()
    setDrag({ x: g.ox + dx, y: g.oy + dy })
  }
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current
    if (g.id !== e.pointerId) return
    g.id = -1
    clearTimer()
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {}
    if (!g.moved) return
    g.swallow = true
    const left = g.ox + (e.clientX - g.sx)
    const next: TriggerPos = {
      edge: left + size / 2 < window.innerWidth / 2 ? 'left' : 'right',
      y: clampY(g.oy + (e.clientY - g.sy), size, insets),
    }
    setDrag(null)
    onMove(next)
  }
  const onPointerCancel = () => {
    gesture.current.id = -1
    clearTimer()
    setDrag(null)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="kitr-dt-trigger"
        aria-label="Open kitr devtools"
        title="kitr devtools"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerEnter={() => setNear(true)}
        onPointerLeave={() => setNear(false)}
        onFocus={() => setNear(true)}
        onBlur={() => setNear(false)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (gesture.current.swallow) {
            gesture.current.swallow = false
            return
          }
          onOpen()
        }}
      >
        {tab ? null : <MarkColor size={phone ? 24 : 20} />}
        {count > 0 && !tab ? (
          <span className="kitr-dt-trigger-badge">{count > 99 ? '99+' : count}</span>
        ) : null}
      </button>
      {menu ? (
        <Menu
          phone={phone}
          onClose={() => setMenu(false)}
          style={
            phone
              ? undefined
              : {
                  position: 'fixed',
                  top: Math.min(y, window.innerHeight - 100),
                  right: pos.edge === 'right' ? MARGIN + size + 8 : 'auto',
                  left: pos.edge === 'left' ? MARGIN + size + 8 : 'auto',
                  marginTop: 0,
                }
          }
          items={[
            { key: 'hide', label: 'Hide for this session', icon: icons.hide, onSelect: onHide },
            { key: 'reset', label: 'Reset position', icon: icons.reset, onSelect: onReset },
          ]}
        />
      ) : null}
    </>
  )
}
