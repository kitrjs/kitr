import { definePackage, generatorFile, naming } from '@kitr/core/package'

/** `kitr add state`: Zustand with an SSR-safe store factory (per-request stores on the server). */
export default definePackage({
  name: 'state',
  client: true,
  add(ctx) {
    ctx.deps.add('zustand')
    ctx.write('app/stores/.gitkeep', '')
    ctx.agents.add(
      'state',
      `- Client state only. \`kitr make:store <name>\` writes \`app/stores/<name>.ts\` using \`createKitrStore\`; wrap the components that use it in its \`<NameStoreProvider>\`, or server rendering and prerendering throw. Server data belongs in queries, not stores.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove('zustand')
    ctx.agents.remove('state')
  },
  generators: {
    store: {
      description: 'Create a Zustand store in app/stores',
      definition: 'Client-only state; server data belongs in queries, not here.',
      target: (name, project) => generatorFile(project, 'app', 'stores', name),
      stub: ({ name }) => `import { createKitrStore } from '@kitr/state'

interface ${naming.pascal(name)}State {
  count: number
  increment: () => void
  reset: () => void
}

/**
 * Wrap the components that call \`use${naming.pascal(name)}Store()\` in \`<${naming.pascal(name)}StoreProvider>\`.
 * Without it the store works in the browser, but server rendering and prerendering throw
 * "Store has no instance on the server".
 */
export const [use${naming.pascal(name)}Store, ${naming.pascal(name)}StoreProvider, ${naming.camel(name)}Store] = createKitrStore<${naming.pascal(name)}State>(
  { name: '${naming.snake(name)}', persist: false },
  (set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
    reset: () => set({ count: 0 }),
  }),
)
`,
      // The folder now has a real file: the placeholder `kitr add state` wrote is no longer needed.
      after(ctx) {
        const keep = `${ctx.rc.directories.app ?? 'app'}/stores/.gitkeep`
        if (ctx.exists(keep)) ctx.unlink(keep)
      },
    },
  },
  wraps: { zustand: '@kitr/state' },
  eject: { '@kitr/state': 'zustand' },
  vite: { optimizeDeps: ['zustand'] },
})
