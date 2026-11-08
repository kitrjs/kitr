import { definePackage } from '@kitr/core/package'

/** `kitr add cache`: remember slow results on the server and clear them by tag when the data changes. */
export default definePackage({
  name: 'cache',
  requires: ['server'],
  add(ctx) {
    ctx.provider.add('@kitr/cache/provider')
    ctx.config(
      'cache',
      `import { defineConfig } from '@kitr/cache'\n\nexport default defineConfig({\n  // In-memory by default. For several instances pass a shared driver (Redis, Upstash) as \`driver\`.\n  prefix: '${(ctx.pkg.name ?? 'app').replace(/^@[^/]+\//, '')}:',\n  defaultTtl: 300,\n})\n`,
    )
    ctx.agents.add(
      'cache',
      `- Expensive reads go through \`cache.remember(key, fn, { ttl, tags })\` or \`cached(cache, fn, { key, ttl, tags })\` from \`@kitr/cache\`; \`useCache(ctx.app)\` in controllers and actions. Invalidate by tag after a write (\`cache.invalidateTags('projects')\`) instead of guessing keys.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/cache/provider')
    ctx.agents.remove('cache')
  },
  vite: { serverOnlyConfig: true },
})
