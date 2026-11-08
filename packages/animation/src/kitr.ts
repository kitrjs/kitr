import { definePackage } from '@kitr/core/package'

/** The `config/animation.ts` that `kitr add animation` writes. */
export const animationConfig = `import { defineConfig, transitions } from '@kitr/animation'

export default defineConfig({
  // 'user' follows the visitor's "reduce motion" setting: movement stops, fades still run.
  reducedMotion: 'user',
  // Every motion element uses this unless it sets its own transition.
  transition: transitions.base,
  // Animations finish instantly under Vitest. Set true for screenshot tests too.
  // skipAnimations: true,
})
`

/** `kitr add animation`: Motion with the app's reduced-motion policy, shared presets and page transitions. */
export default definePackage({
  name: 'animation',
  requires: ['react'],
  client: true,
  add(ctx) {
    ctx.deps.add('motion')
    ctx.provider.add('@kitr/animation/provider')
    ctx.config('animation', animationConfig)
    ctx.agents.add(
      'animation',
      `- Animate with \`motion\` from \`@kitr/animation\` (Motion for React), never \`framer-motion\` or \`motion/react\` directly. Spread a preset for enter/exit (\`<motion.li {...presets.fadeUp} />\`, inside \`<AnimatePresence>\` for exits) and use \`transitions.fast|base|slow|snappy\` instead of ad-hoc durations.\n- Scroll-in sections use \`<Reveal>\` (\`stagger\` + \`<RevealItem>\` for lists). Page changes use \`defaultViewTransition: pageTransitions()\` in \`app/router.tsx\` with \`import '@kitr/animation/page-transitions.css'\`.\n- Reduced motion is handled by \`config/animation.ts\`; don't check \`prefers-reduced-motion\` by hand.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/animation/provider')
    ctx.deps.remove('motion')
    ctx.agents.remove('animation')
  },
  wraps: { 'motion/react': '@kitr/animation', 'framer-motion': '@kitr/animation' },
  eject: { '@kitr/animation': 'motion/react' },
  vite: { optimizeDeps: ['motion/react'] },
})
