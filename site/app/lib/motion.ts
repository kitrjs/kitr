import { useEffect, useState } from 'react'

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
