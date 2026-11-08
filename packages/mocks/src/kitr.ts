import { definePackage } from '@kitr/core/package'

/** `kitr add mocks`: MSW handlers from route tables and contracts, for dev without a backend and for tests. */
export default definePackage({
  name: 'mocks',
  client: true,
  add(ctx) {
    ctx.deps.add({ name: 'msw', dev: true })
    ctx.write(
      'app/mocks/handlers.ts',
      `import { HttpResponse, http } from '@kitr/mocks'\n\nexport const handlers = [\n  http.get('*/me', () => HttpResponse.json({ id: 'u1', email: 'dev@example.com', role: 'admin' })),\n]\n`,
    )
    ctx.write(
      'app/mocks/browser.ts',
      `import { setupBrowserMocks } from '@kitr/mocks'\nimport { handlers } from './handlers'\n\n/**\n * \`await enableMocks()\` in the client entry. Env values are strings, so only \`VITE_MOCKS=true\`\n * turns mocks on (\`false\` would be truthy), and only in dev.\n */\nexport async function enableMocks() {\n  if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === 'true') await setupBrowserMocks(handlers)\n}\n`,
    )
    // MSW serves from a worker script in public/: `msw init` writes it, and msw's postinstall
    // refreshes it from this field on every install.
    ctx.packageJson.set('msw', { workerDirectory: ['public'] })
    ctx.scripts.add('mocks:init', 'msw init public')
    ctx.env.add({ VITE_MOCKS: 'false' }, 'Set true to serve app/mocks/handlers.ts in the browser')
    ctx.agents.add(
      'mocks',
      `- Mocks live in \`app/mocks/handlers.ts\` (MSW). \`VITE_MOCKS=true\` enables them in dev (run \`npm run mocks:init\` once if public/mockServiceWorker.js is missing); tests use \`setupNodeMocks(handlers)\`. Mock a kitr route table with \`mockRoutes(routes.toJSON(), baseUrl, { 'projects.index': () => [...] })\`.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove('msw')
    ctx.packageJson.remove('msw', { workerDirectory: ['public'] })
    ctx.scripts.remove('mocks:init', 'msw init public')
    ctx.agents.remove('mocks')
  },
  eject: { '@kitr/mocks': 'msw' },
})
