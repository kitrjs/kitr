import type { TargetAndTransition, Transition, Variants } from 'motion/react'

/** Material's "emphasized decelerate" curve: quick to start, gentle to land. */
const decelerate = [0.05, 0.7, 0.1, 1] as const
/** For things leaving the screen: gentle to start, quick to finish. */
const accelerate = [0.3, 0, 0.8, 0.15] as const

/**
 * Named timings shared by the whole app, so a list, a dialog and a toast move with the same
 * rhythm. Durations are in seconds, as Motion expects.
 */
// kitr-allow-module-state: lookup table built once at import, never mutated
export const transitions = {
  /** Hover, press and small state changes: 0.15s. */
  fast: { duration: 0.15, ease: decelerate },
  /** The default for things entering the screen: 0.25s. */
  base: { duration: 0.25, ease: decelerate },
  /** Large surfaces such as sheets and full-page panels: 0.4s. */
  slow: { duration: 0.4, ease: decelerate },
  /** Things leaving the screen: 0.2s, accelerating out. */
  exit: { duration: 0.2, ease: accelerate },
  /** A critically damped spring with no overshoot: drag, reorder and layout changes. */
  snappy: { type: 'spring', visualDuration: 0.3, bounce: 0 },
  /** A spring with a little overshoot: playful confirmations, badges, likes. */
  bouncy: { type: 'spring', visualDuration: 0.4, bounce: 0.3 },
} satisfies Record<string, Transition>

/** A transition name from `transitions`. */
export type TransitionName = keyof typeof transitions

/**
 * Props to spread on a `motion` element so it animates in on mount and out on exit:
 * `initial`, `animate`, `exit` and `transition`. Spread order lets you override any of them.
 */
export interface Preset {
  initial: TargetAndTransition
  animate: TargetAndTransition
  exit: TargetAndTransition
  transition: Transition
}

function preset(
  hidden: TargetAndTransition,
  shown: TargetAndTransition,
  transition: Transition = transitions.base,
): Preset {
  return {
    initial: hidden,
    animate: shown,
    exit: { ...hidden, transition: transitions.exit },
    transition,
  }
}

/**
 * Enter and exit animations for the common cases. Spread one on a `motion` element:
 * `<motion.li {...presets.fadeUp} />`. Inside `<AnimatePresence>`, the `exit` half runs when the
 * element is removed.
 */
// kitr-allow-module-state: lookup table built once at import, never mutated
export const presets = {
  /** Opacity only. Safe under reduced motion, since nothing moves. */
  fade: preset({ opacity: 0 }, { opacity: 1 }),
  /** Fade in while rising 12px: list items, cards, toasts at the bottom. */
  fadeUp: preset({ opacity: 0, y: 12 }, { opacity: 1, y: 0 }),
  /** Fade in while dropping 12px: menus and toasts at the top. */
  fadeDown: preset({ opacity: 0, y: -12 }, { opacity: 1, y: 0 }),
  /** Fade in from 95% size: dialogs, popovers, previews. */
  scale: preset({ opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1 }, transitions.snappy),
  /** Slide in from the right edge: drawers and detail panels. */
  slideLeft: preset({ opacity: 0, x: 24 }, { opacity: 1, x: 0 }, transitions.slow),
  /** Slide in from the left edge: navigation drawers. */
  slideRight: preset({ opacity: 0, x: -24 }, { opacity: 1, x: 0 }, transitions.slow),
  /** Open from zero height to the content's height: accordions and expanding rows. */
  collapse: preset(
    { opacity: 0, height: 0, overflow: 'hidden' },
    { opacity: 1, height: 'auto', overflow: 'hidden' },
  ),
} satisfies Record<string, Preset>

/** A preset name from `presets`. */
export type PresetName = keyof typeof presets

/** The `hidden` and `visible` variants of a preset, for parents that drive their children by label. */
export function presetVariants(name: PresetName): Variants {
  const p: Preset = presets[name]
  return { hidden: p.initial, visible: { ...p.animate, transition: p.transition } }
}
