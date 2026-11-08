import { type ReactNode, useRef, useState } from 'react'
import type { Viewport } from './use-layout'

export type Snap = 'half' | 'full'

const CLOSE_PULL = 80
const FLICK = 0.5

/**
 * The phone window: a bottom sheet with a drag handle and two snap points. The header is passed
 * in so a drag that starts on its empty space moves the sheet too. It does not set `aria-modal`,
 * because the page behind stays usable. Height follows the visual viewport, so the keyboard
 * shrinks the sheet instead of covering the input.
 */
export function Sheet({
  snap,
  viewport,
  safeTop,
  onSnap,
  onClose,
  header,
  children,
}: {
  snap: Snap
  viewport: Viewport
  safeTop: number
  onSnap: (snap: Snap) => void
  onClose: () => void
  header: ReactNode
  children: ReactNode
}) {
  const half = Math.round(viewport.height * 0.5)
  const full = Math.max(half, Math.round(viewport.height - safeTop - 8))
  const [dragH, setDragH] = useState<number | null>(null)
  const g = useRef({ id: -1, y: 0, h: 0, moved: false })
  const height = dragH ?? (snap === 'full' ? full : half)

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const onHandle = target.closest('.kitr-dt-handle')
    if (!onHandle && target.closest('button,input,[role="tab"],[role="menu"]')) return
    g.current = { id: e.pointerId, y: e.clientY, h: height, moved: false }
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {}
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = g.current
    if (s.id !== e.pointerId) return
    const dy = e.clientY - s.y
    if (!s.moved && Math.abs(dy) < 4) return
    s.moved = true
    setDragH(Math.max(0, Math.min(full, s.h - dy)))
  }
  const velocity = useRef({ y: 0, t: 0, v: 0 })
  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = velocity.current
    const dt = e.timeStamp - p.t
    if (dt > 0 && p.t) p.v = (e.clientY - p.y) / dt
    p.y = e.clientY
    p.t = e.timeStamp
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = g.current
    if (s.id !== e.pointerId) return
    s.id = -1
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {}
    if (!s.moved) return
    const current = dragH ?? height
    const v = velocity.current.v
    velocity.current = { y: 0, t: 0, v: 0 }
    setDragH(null)
    if (current < half - CLOSE_PULL) return onClose()
    if (Math.abs(v) > FLICK) {
      const next: Snap = v < 0 ? 'full' : 'half'
      return onSnap(next)
    }
    onSnap(current > (half + full) / 2 ? 'full' : 'half')
  }

  return (
    <div
      className="kitr-dt-sheet"
      data-snap={snap}
      style={
        {
          '--kitr-dt-height': `${height}px`,
          bottom: viewport.bottom,
          transition: dragH === null ? undefined : 'none',
        } as React.CSSProperties
      }
    >
      <div
        // touch-action none here, pan-x on the tab strip: Chromium otherwise cancels a vertical touch
        // drag that starts on the handle or the header, and the sheet never sees it move.
        style={{ flex: 'none', touchAction: 'none' }}
        onPointerDown={(e) => {
          velocity.current = { y: e.clientY, t: e.timeStamp, v: 0 }
          onDown(e)
        }}
        onPointerMove={(e) => {
          track(e)
          onMove(e)
        }}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="kitr-dt-handle" />
        {header}
      </div>
      {children}
    </div>
  )
}
