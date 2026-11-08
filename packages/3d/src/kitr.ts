import { definePackage } from '@kitr/core/package'
import { dracoModels, hasDecoders } from './decoders'

/** `kitr add 3d`: React Three Fiber, drei and three.js, with `<Scene>`, theme colours and offline model decoders. */
export default definePackage({
  name: '3d',
  requires: ['react'],
  client: true,
  add(ctx) {
    ctx.deps.add('three', '@react-three/fiber', '@react-three/drei')
    ctx.deps.add({ name: '@types/three', dev: true })
    ctx.agents.add(
      '3d',
      `- 3D: wrap every scene in \`<Scene>\` from \`@kitr/3d\` (not a bare \`<Canvas>\`): it renders client-only, shows \`fallback\` without WebGL or on error, pauses off screen and respects reduced motion. Give it a size with \`className\`.\n- Hooks and components come from \`@kitr/3d\` (React Three Fiber) and \`@kitr/3d/drei\` (drei); \`three\` itself is imported directly. Load models with \`useModel('/models/<name>.glb')\` and keep them in \`public/models/\`.\n- Colours from the theme: \`useThemeColor('--kitr-color-primary')\`, never hard-coded hex values. Run \`kitr 3d:decoders\` once when a model is Draco-compressed.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove('three', '@react-three/fiber', '@react-three/drei', '@types/three')
    ctx.agents.remove('3d')
  },
  commands: () => import('./commands'),
  doctor(project) {
    const models = dracoModels(project.root)
    if (!models.length || hasDecoders(project.root)) return []
    return [
      {
        level: 'warn',
        message: `${models[0]}${models.length > 1 ? ` and ${models.length - 1} more` : ''} ${models.length > 1 ? 'are' : 'is'} Draco-compressed but public/draco has no decoder, so useModel() will fail to load ${models.length > 1 ? 'them' : 'it'}`,
        fix: 'kitr 3d:decoders',
      },
    ]
  },
  wraps: { '@react-three/fiber': '@kitr/3d', '@react-three/drei': '@kitr/3d/drei' },
  eject: { '@kitr/3d': '@react-three/fiber', '@kitr/3d/drei': '@react-three/drei' },
  vite: { optimizeDeps: ['three', '@react-three/fiber', '@react-three/drei'] },
})
