import { type MouseEvent, useEffect, useState } from 'react'

/**
 * How long each exit plays, in ms. They match the exit durations in motion.css, plus a frame, so
 * the element unmounts right after its last visible frame and not while it is still on screen.
 */
export const exit = {
  popover: 160,
  drawer: 240,
} as const

/**
 * Keeps something mounted while it animates out. `mounted` turns true the moment `open` does and
 * stays true for `duration` ms after `open` turns false; `closing` is the stretch in between, so
 * CSS can play the exit. Opening again while it closes just reverses it, with no remount. Under
 * reduced motion the exit is skipped and it unmounts at once.
 */
export function usePresence(
  open: boolean,
  duration: number,
): { mounted: boolean; closing: boolean } {
  const [lingering, setLingering] = useState(false)
  useEffect(() => {
    if (open) {
      setLingering(true)
      return
    }
    // matchMedia is only read here, in an effect, because the site is prerendered on the server.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || duration <= 0) {
      setLingering(false)
      return
    }
    const timer = setTimeout(() => setLingering(false), duration)
    return () => clearTimeout(timer)
  }, [open, duration])
  // Derived from `open` too, so the first open renders mounted without waiting for the effect.
  const mounted = open || lingering
  return { mounted, closing: mounted && !open }
}

/**
 * True once `value` has differed from what it was on the first render. Swap animations (an icon
 * that changes, a code block that re-renders) use it so they play when the visitor changes
 * something, never on page load or hydration.
 */
export function useSwapped(value: unknown): boolean {
  const [initial] = useState(value)
  const [swapped, setSwapped] = useState(false)
  const differs = !Object.is(value, initial)
  // Remembered, so changing back to the first value animates too.
  if (differs && !swapped) setSwapped(true)
  return swapped || differs
}

/**
 * A click handler (for onClickCapture on a menu or drawer) that closes it first and follows the
 * link once it has animated out. Navigating at once would swap the page while the panel is still
 * on screen: the drawer's links re-render and shift as it slides away, and the header menu is
 * caught in the route transition's snapshot and fades out over the new page. In-page hash links,
 * new tabs and modified clicks just close the panel and go ahead as usual.
 */
export function closeThenFollow(
  close: () => void,
  duration: number,
  navigate: (href: string) => void,
) {
  return (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a) return
    close()
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return
    if ((a.target && a.target !== '_self') || a.origin !== window.location.origin) return
    if (a.pathname === window.location.pathname) return
    e.preventDefault()
    const href = a.pathname + a.search + a.hash
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => navigate(href), reduced ? 0 : duration)
  }
}
