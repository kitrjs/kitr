import type { KitrApp } from '@kitr/core'
import { useEffect, useState } from 'react'

/** Phones, and landscape phones where the viewport is short but wide. */
export const PHONE_QUERY = '(max-width: 640px), ((pointer: coarse) and (max-height: 500px))'

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

function matches(query: string): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia(query).matches
  } catch {
    return false
  }
}

/** Tracks a media query; false where `matchMedia` does not exist. */
export function useMedia(query: string): boolean {
  const [value, setValue] = useState(() => matches(query))
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mql = matchMedia(query)
    const update = () => setValue(mql.matches)
    update()
    mql.addEventListener?.('change', update)
    return () => mql.removeEventListener?.('change', update)
  }, [query])
  return value
}

export const useIsPhone = () => useMedia(PHONE_QUERY)

/** The visible part of the page: shrinks when the soft keyboard opens. */
export interface Viewport {
  height: number
  offsetTop: number
  /** Distance from the layout viewport's bottom edge to the visible area's bottom edge. */
  bottom: number
}

function measure(): Viewport {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  const height = vv?.height ?? window.innerHeight
  const offsetTop = vv?.offsetTop ?? 0
  return {
    height: Math.round(height),
    offsetTop: Math.round(offsetTop),
    bottom: Math.max(0, Math.round(window.innerHeight - height - offsetTop)),
  }
}

/** `visualViewport` height and offset, falling back to the window where it is missing. */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState(measure)
  useEffect(() => {
    const update = () =>
      setViewport((prev) => {
        const next = measure()
        return prev.height === next.height &&
          prev.offsetTop === next.offsetTop &&
          prev.bottom === next.bottom
          ? prev
          : next
      })
    const vv = window.visualViewport
    window.addEventListener('resize', update)
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    update()
    return () => {
      window.removeEventListener('resize', update)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
    }
  }, [])
  return viewport
}

/** Safe-area insets in px: the platform service when the app has one, else a CSS `env()` probe. */
export function readInsets(app: KitrApp): Insets {
  try {
    if (app.container.has('platform')) {
      const area = (
        app.container.use('platform' as never) as { safeArea?: () => Insets }
      ).safeArea?.()
      if (area) return area
    }
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
    document.body.appendChild(probe)
    const style = getComputedStyle(probe)
    const px = (v: string) => Number.parseFloat(v) || 0
    const insets = {
      top: px(style.paddingTop),
      right: px(style.paddingRight),
      bottom: px(style.paddingBottom),
      left: px(style.paddingLeft),
    }
    probe.remove()
    return insets
  } catch {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }
}
