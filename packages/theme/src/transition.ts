import type { ResolvedTheme } from './theme'

/** The animations `@kitr/theme/styles.css` ships for a theme change. */
export type ThemeTransitionName = 'fade' | 'circle' | 'diamond' | 'wipe' | 'blur'

/** The way a `wipe` sweeps across the page. */
export type ThemeTransitionDirection = 'up' | 'down' | 'left' | 'right'

/** What a custom `animate` function gets once both pictures of the view transition are ready. */
export interface ThemeTransitionContext {
  /** The browser's `ViewTransition`; `finished` settles when the change is over. */
  transition: ViewTransition
  /** The theme on screen before the change. */
  from: ResolvedTheme
  /** The theme on screen after it. */
  to: ResolvedTheme
  /** Where the change starts, in viewport pixels: the centre of `from`, or the top centre. */
  origin: { x: number; y: number }
  /** Milliseconds, from the options or the default. */
  duration: number
  /** A CSS easing, from the options or the default. */
  easing: string
}

/** A theme change animation with its timing. */
export interface ThemeTransitionOptions {
  /**
   * A built-in animation, or the name of your own: `<html>` carries
   * `data-kitr-theme-transition="<name>"` while it runs, for your CSS to target. Default `'fade'`.
   */
  name?: ThemeTransitionName | (string & {})
  /** Milliseconds. Default `400`. */
  duration?: number
  /** Any CSS easing. Default `'cubic-bezier(0.65, 0, 0.35, 1)'`. */
  easing?: string
  /** For `wipe`: the way the new theme sweeps across. Default `'down'`, top to bottom. */
  direction?: ThemeTransitionDirection
  /** Animate it yourself, usually with `element.animate()` on `::view-transition-new(root)`. */
  animate?: (context: ThemeTransitionContext) => void
}

/** A transition by name, with its timing, or `false` for an instant change. */
export type ThemeTransition = ThemeTransitionName | (string & {}) | ThemeTransitionOptions | false

const DURATION = 400
const EASING = 'cubic-bezier(0.65, 0, 0.35, 1)'

// kitr-allow-module-state: lookup table of CSS names, never mutated
const VARS = {
  x: '--kitr-theme-transition-x',
  y: '--kitr-theme-transition-y',
  duration: '--kitr-theme-transition-duration',
  easing: '--kitr-theme-transition-easing',
}
// kitr-allow-module-state: lookup table of attribute names, never mutated
const ATTRS = {
  name: 'data-kitr-theme-transition',
  to: 'data-kitr-theme-to',
  direction: 'data-kitr-theme-direction',
}

// kitr-allow-module-state: a document runs one view transition at a time, whichever app started it
let running: ViewTransition | null = null

/**
 * Applies a theme inside a view transition, or at once when `transition` is unset or `false`, the
 * visitor asks for less motion, the browser has no view transitions or nothing would change.
 */
export function changeTheme(
  apply: () => void,
  change: {
    transition: ThemeTransition | undefined
    from: ResolvedTheme
    to: ResolvedTheme
    origin?: Element | { x: number; y: number }
  },
): void {
  const options = normalize(change.transition)
  if (
    !options ||
    change.from === change.to ||
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    apply()
    return
  }
  running?.skipTransition()
  const root = document.documentElement
  const name = options.name ?? (options.animate ? 'custom' : 'fade')
  const duration = options.duration ?? DURATION
  const easing = options.easing ?? EASING
  const point = change.origin
    ? change.origin instanceof Element
      ? centre(change.origin.getBoundingClientRect())
      : change.origin
    : undefined
  if (point) {
    root.style.setProperty(VARS.x, `${point.x}px`)
    root.style.setProperty(VARS.y, `${point.y}px`)
  }
  root.style.setProperty(VARS.duration, `${duration}ms`)
  root.style.setProperty(VARS.easing, easing)
  root.setAttribute(ATTRS.name, name)
  root.setAttribute(ATTRS.to, change.to)
  root.setAttribute(ATTRS.direction, options.direction ?? 'down')
  const transition = document.startViewTransition(apply)
  running = transition
  if (options.animate) {
    const animate = options.animate
    transition.ready
      .then(() =>
        animate({
          transition,
          from: change.from,
          to: change.to,
          origin: point ?? { x: window.innerWidth / 2, y: 0 },
          duration,
          easing,
        }),
      )
      .catch(() => {})
  }
  transition.finished
    .finally(() => {
      if (running !== transition) return
      running = null
      for (const attr of Object.values(ATTRS)) root.removeAttribute(attr)
      for (const v of Object.values(VARS)) root.style.removeProperty(v)
    })
    .catch(() => {})
}

function normalize(transition: ThemeTransition | undefined): ThemeTransitionOptions | null {
  if (!transition) return null
  return typeof transition === 'string' ? { name: transition } : transition
}

function centre(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
