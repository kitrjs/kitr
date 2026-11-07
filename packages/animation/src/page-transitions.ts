import type { ReducedMotion } from './config'

/** The look of a page change. `'slide'` pushes pages sideways like a native app; `'fade'` cross-fades. */
export type PageTransitionStyle = 'slide' | 'fade'

/** Options of `pageTransitions()`. */
export interface PageTransitionOptions {
  /** How pages change. Default `'slide'`. */
  style?: PageTransitionStyle
  /** With `'user'` (the default) there is no page animation for visitors who ask for less motion. */
  reducedMotion?: ReducedMotion
  /** Also animate when only the search or hash changes, such as a new page of a table. Default `false`. */
  onSearchChange?: boolean
}

/** The part of a router location `pageTransitions()` reads: TanStack Router's history index. */
interface LocationLike {
  state?: { __TSR_index?: number }
}

/** What TanStack Router passes to a view transition's `types` function on every navigation. */
export interface LocationChange {
  fromLocation?: LocationLike
  toLocation: LocationLike
  pathChanged: boolean
  hrefChanged: boolean
}

/** The value for TanStack Router's `defaultViewTransition` option. */
export interface PageTransitionsValue {
  types: (change: LocationChange) => string[] | false
}

/** Did the visitor ask the operating system for less motion? False where it cannot be asked. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Animated page changes for `createKitrRouter`, through the browser's View Transitions API:
 * `defaultViewTransition: pageTransitions()`. Each navigation gets the types
 * `kitr-<style>` and `kitr-forward` or `kitr-back` (from the history index, so the browser's
 * back button slides the other way), which `kitr/animation/page-transitions.css` animates.
 * Browsers without view transitions change pages instantly.
 */
export function pageTransitions(options: PageTransitionOptions = {}): PageTransitionsValue {
  const style = options.style ?? 'slide'
  const reduced = options.reducedMotion ?? 'user'
  return {
    types({ fromLocation, toLocation, pathChanged, hrefChanged }) {
      if (reduced === 'always' || (reduced === 'user' && prefersReducedMotion())) return false
      // The first render of the app is not a page change.
      if (!fromLocation) return false
      if (!pathChanged && !(options.onSearchChange && hrefChanged)) return false
      const from = fromLocation.state?.__TSR_index ?? 0
      const to = toLocation.state?.__TSR_index ?? from + 1
      return [`kitr-${style}`, to < from ? 'kitr-back' : 'kitr-forward']
    },
  }
}
