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
 * caught in the route transition's snapshot and fades out over the new page. A link to a section of
 * the current page closes the panel and then scrolls there. New tabs and modified clicks just
 * close the panel and go ahead as usual.
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
    const samePage = a.pathname === window.location.pathname && a.search === window.location.search
    if (samePage && !a.hash) return
    e.preventDefault()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // A section on this page: jump once the panel has gone and the page can scroll again (the
    // drawer locks it while open), a frame after the exit so the lock is off.
    if (samePage)
      window.setTimeout(() => requestAnimationFrame(() => jumpTo(a.hash)), reduced ? 0 : duration)
    else window.setTimeout(() => navigate(a.pathname + a.search + a.hash), reduced ? 0 : duration)
  }
}

/**
 * Scrolls to an in-page anchor the way a click on it would: smoothly unless reduced motion is on
 * (motion.css sets scroll-behavior), stopping under the sticky header (scroll-padding-top), and
 * putting the hash in the address bar. Setting the same hash again scrolls nowhere, so then it
 * scrolls the heading into view itself.
 */
function jumpTo(hash: string) {
  if (window.location.hash !== hash) window.location.hash = hash
  else document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
}
