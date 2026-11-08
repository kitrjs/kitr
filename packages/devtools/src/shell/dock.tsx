import { type ReactNode, useRef } from 'react'

export const MIN_SIZE = 160
const EDGE_GAP = 48

/** The desktop window: docked to the bottom or the right edge, resizable with the pointer. */
export function Dock({
  side,
  size,
  onResize,
  onResizeEnd,
  children,
}: {
  side: 'bottom' | 'right'
  size: number
  onResize: (size: number) => void
  onResizeEnd: (size: number) => void
  children: ReactNode
}) {
  const vertical = side === 'bottom'
  const drag = useRef({ pointer: 0, size: 0, last: size })
  const clamp = (value: number) =>
    Math.round(
      Math.max(
        MIN_SIZE,
        Math.min((vertical ? window.innerHeight : window.innerWidth) - EDGE_GAP, value),
      ),
    )
  return (
    <div
      className="kitr-dt-panel"
      data-dock={side}
      style={
        {
          [vertical ? '--kitr-dt-height' : '--kitr-dt-width']: `${size}px`,
          [vertical ? 'maxHeight' : 'maxWidth']: `calc(100% - ${EDGE_GAP}px)`,
        } as React.CSSProperties
      }
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a draggable splitter; <hr> cannot take pointer handlers meaningfully */}
      <div
        className={vertical ? 'kitr-dt-resize kitr-dt-resize-y' : 'kitr-dt-resize kitr-dt-resize-x'}
        role="separator"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        aria-valuenow={size}
        aria-valuemin={MIN_SIZE}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 80 : 20
          const grow = vertical ? 'ArrowUp' : 'ArrowLeft'
          const shrink = vertical ? 'ArrowDown' : 'ArrowRight'
          if (e.key !== grow && e.key !== shrink) return
          e.preventDefault()
          const next = clamp(size + (e.key === grow ? step : -step))
          onResize(next)
          onResizeEnd(next)
        }}
        onPointerDown={(e) => {
          e.preventDefault()
          drag.current.pointer = vertical ? e.clientY : e.clientX
          drag.current.size = size
          drag.current.last = size
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId)
          } catch {}
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture?.(e.pointerId) && !drag.current.size) return
          const delta = (vertical ? e.clientY : e.clientX) - drag.current.pointer
          drag.current.last = clamp(drag.current.size - delta)
          onResize(drag.current.last)
        }}
        onPointerUp={(e) => {
          try {
            e.currentTarget.releasePointerCapture?.(e.pointerId)
          } catch {}
          if (drag.current.size) onResizeEnd(drag.current.last)
          drag.current.size = 0
        }}
      />
      {children}
    </div>
  )
}
