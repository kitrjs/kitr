import { definePackage, naming } from '@kitr/core/package'

/** `kitr add state`: Zustand with an SSR-safe store factory (per-request stores on the server). */
export default definePackage({
  name: 'state',
  client: true,
  add(ctx) {
    ctx.deps.add('zustand')
    ctx.write('app/stores/.gitkeep', '')
    ctx.agents.add(
      'state',
      `- Client state only. \`kitr make:store <name>\` writes \`app/stores/<name>.ts\` using \`createKitrStore\`. Server data belongs in queries, not stores.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove('zustand')
    ctx.agents.remove('state')
  },
  generators: {
    store: {
      description: 'Create a Zustand store in app/stores',
      target: (name, project) => ({
        file: `${project.rc.directories.app ?? 'app'}/stores/${naming.snake(name)}.ts`,
      }),
      stub: ({ name }) => `import { createKitrStore } from 'kitr/state'

interface ${naming.pascal(name)}State {
  count: number
  increment: () => void
  reset: () => void
}

export const [use${naming.pascal(name)}Store, ${naming.pascal(name)}StoreProvider, ${naming.camel(name)}Store] = createKitrStore<${naming.pascal(name)}State>(
  { name: '${naming.snake(name)}', persist: false },
  (set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
    reset: () => set({ count: 0 }),
  }),
)
`,
    },
  },
  wraps: { zustand: 'kitr/state' },
  eject: { 'kitr/state': 'zustand' },
  vite: { optimizeDeps: ['zustand'] },
})
