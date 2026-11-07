import { createDefineConfig } from '@kitr/core'
import type { Transition } from 'motion/react'

/**
 * How the app treats the visitor's "reduce motion" setting: `'user'` follows it, `'always'`
 * behaves as if it were on for everyone, `'never'` ignores it.
 */
export type ReducedMotion = 'user' | 'always' | 'never'

/** `config/animation.ts`: the defaults every animation in the app starts from. */
export interface AnimationConfig {
  /**
   * What to do when the visitor asks for less motion. With `'user'` (the default), movement
   * (`x`, `y`, `scale`, `rotate`, layout) is switched off for them while fades still run.
   */
  reducedMotion?: ReducedMotion
  /** The transition every `motion` element uses unless it sets its own. Default `transitions.base`. */
  transition?: Transition
  /**
   * Jump every animation straight to its end. Default: on under Vitest, so tests never wait for
   * an animation, and off everywhere else. Turn it on for screenshot tests.
   */
  skipAnimations?: boolean
  /** A CSP nonce for the `<style>` tags Motion adds for layout and exit animations. */
  nonce?: string
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    animation: AnimationConfig
  }
}

/** Types the default export of `config/animation.ts`: reduced motion, the default transition and test mode. */
export const defineConfig = createDefineConfig<AnimationConfig>()
