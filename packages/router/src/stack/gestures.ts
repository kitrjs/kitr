/**
 * Pointer gestures for the stack: the iOS edge swipe that pops a pushed page, and the drag that
 * dismisses a cover or a sheet. Pure DOM so the rules can be tested without React.
 */

export interface GestureRule {
  /** Pointers must start within this many pixels of the edge (swipe back). Default 24. */
  edge?: number
  /** Movement needed before the gesture claims the pointer. Default 8. */
  slop?: number
  /** Fraction of the page that commits a release with no speed. Default 0.3. */
  commitAt?: number
  /** Velocity (px/s) that commits regardless of distance. Default 800. */
  velocity?: number
}

/** Whether a release at `distance` of `size` pixels, moving at `velocity` px/s, pops the page. */
export function shouldCommit(
  distance: number,
  size: number,
  velocity: number,
  rule: GestureRule = {},
): boolean {
  const { commitAt = 0.3, velocity: fast = 800 } = rule
  if (velocity <= -fast / 2) return false
  if (velocity >= fast) return true
  return size > 0 && distance / size >= commitAt
}

/** What `attachDrag()` needs: the axis, whether the drag starts at the edge, and the progress callbacks. */
export interface DragGestureOptions extends GestureRule {
  /** `x`: horizontal from the left edge (swipe back). `y`: downward from anywhere (dismiss). */
  axis: 'x' | 'y'
  /** Start only at the leading edge (swipe back) or anywhere (dismiss). */
  fromEdge: boolean
  /** Progress 0..1 as the pointer moves. */
  onProgress(progress: number): void
  /** The pointer lifted: `commit` says whether to pop; `progress` is where it stopped. */
  onEnd(commit: boolean, progress: number): void
  /** Called when the gesture claims the pointer (after `slop`). */
  onStart?(): void
  /** Whether a gesture may start now (not mid-transition, not at the root). */
  enabled?(): boolean
}

/** Attach a drag gesture to a page element. Returns the detach function. */
export function attachDrag(element: HTMLElement, options: DragGestureOptions): () => void {
  const { axis, fromEdge, edge = 24, slop = 8 } = options
  let pointerId: number | undefined
  let startX = 0
  let startY = 0
  let claimed = false
  let lastPos = 0
  let lastTime = 0
  let velocity = 0
  let progress = 0

  const size = () => (axis === 'x' ? element.clientWidth : element.clientHeight) || 1
  const posOf = (e: PointerEvent) => (axis === 'x' ? e.clientX : e.clientY)

  const reset = () => {
    pointerId = undefined
    claimed = false
    progress = 0
  }

  const onDown = (e: PointerEvent) => {
    if (pointerId !== undefined || e.button !== 0) return
    if (options.enabled && !options.enabled()) return
    const rect = element.getBoundingClientRect()
    if (fromEdge) {
      const offset = axis === 'x' ? e.clientX - rect.left : e.clientY - rect.top
      if (offset > edge) return
    } else if (axis === 'y' && isScrolledAway(e.target as Element | null, element)) return
    pointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    lastPos = posOf(e)
    lastTime = e.timeStamp
    velocity = 0
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (!claimed) {
      const along = axis === 'x' ? dx : dy
      const across = axis === 'x' ? Math.abs(dy) : Math.abs(dx)
      if (along < slop) {
        if (across > slop) reset() // Scrolling, not swiping.
        return
      }
      claimed = true
      element.setPointerCapture?.(e.pointerId)
      options.onStart?.()
    }
    const pos = posOf(e)
    const dt = e.timeStamp - lastTime
    if (dt > 0) velocity = ((pos - lastPos) / dt) * 1000
    lastPos = pos
    lastTime = e.timeStamp
    const along = axis === 'x' ? dx : dy
    progress = Math.min(1, Math.max(0, along / size()))
    options.onProgress(progress)
    e.preventDefault()
  }

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    if (claimed) {
      const commit = shouldCommit(progress * size(), size(), velocity, options)
      options.onEnd(commit, progress)
    }
    reset()
  }

  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    if (claimed) options.onEnd(false, progress)
    reset()
  }

  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerup', onUp)
  element.addEventListener('pointercancel', onCancel)
  return () => {
    element.removeEventListener('pointerdown', onDown)
    element.removeEventListener('pointermove', onMove)
    element.removeEventListener('pointerup', onUp)
    element.removeEventListener('pointercancel', onCancel)
  }
}

/** A downward drag inside a scrolled list scrolls it; only a list at its top dismisses the page. */
function isScrolledAway(target: Element | null, page: HTMLElement): boolean {
  let node: Element | null = target
  while (node && node !== page) {
    if (node.scrollTop > 0) return true
    node = node.parentElement
  }
  return page.scrollTop > 0
}
