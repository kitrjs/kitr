import { defineProvider } from '@kitr/core'
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import type { AnimationConfig } from './config'
import { transitions } from './presets'

/**
 * Wraps the app in Motion's `MotionConfig` from `config/animation.ts`: reduced motion follows
 * the visitor's setting, every element shares the app's default transition, and under Vitest
 * animations finish instantly so tests never wait for them.
 */
export const animationProvider = defineProvider({
  name: 'animation',
  wrap(children, app) {
    const config = app.config.get('animation', {} as AnimationConfig)
    return (
      <MotionConfig
        reducedMotion={config.reducedMotion ?? 'user'}
        transition={config.transition ?? transitions.base}
        skipAnimations={config.skipAnimations ?? app.environment === 'test'}
        nonce={config.nonce}
      >
        {children as ReactNode}
      </MotionConfig>
    )
  },
})

export default animationProvider
