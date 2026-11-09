import { definePackage, generatorFile, naming } from '@kitr/core/package'

/** `test/home.test.tsx`: the home page rendered inside the app's own providers. */
const homeTest = `import { renderWithKitr } from '@kitr/testing/react'
import { expect, it } from 'vitest'
import { app } from '#app/app'
import HomePage from '#app/pages/home'

it('renders the home page with its heading', async () => {
  await app.boot()
  const page = renderWithKitr(<HomePage />, { app })
  expect(page.getByRole('heading', { level: 1 }).textContent).toBeTruthy()
})
`

/** `kitr add testing`: Vitest, Testing Library, renderWithKitr and a request client for API tests. */
export default definePackage({
  name: 'testing',
  dev: true,
  add(ctx) {
    const serverOnly = !(ctx.has('react') || ctx.hasPackage('react'))
    ctx.deps.add(
      { name: 'vitest', dev: true },
      ...(serverOnly
        ? []
        : [
            { name: '@testing-library/react', dev: true },
            { name: '@testing-library/dom', dev: true },
            { name: 'happy-dom', dev: true },
          ]),
    )
    ctx.scripts.add('test', 'vitest run')
    ctx.write(
      'vitest.config.ts',
      `import { defineConfig } from 'vitest/config'\n${serverOnly ? '' : "import { kitr } from '@kitr/vite'\n"}\nexport default defineConfig({\n${serverOnly ? '' : '  plugins: [kitr({ plugins: { tailwind: false } })],\n'}  test: {\n    environment: '${serverOnly ? 'node' : 'happy-dom'}',\n    include: ['app/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],\n  },\n})\n`,
    )
    // A React project with the router's starter page gets a real component test; one without it
    // (or with a home page of its own) a boot test; a server-only project an API test.
    const app = ctx.rc.directories.app ?? 'app'
    const home = `${app}/pages/home.tsx`
    const starter =
      !serverOnly &&
      ctx.exists(`${app}/app.ts`) &&
      ctx.exists(home) &&
      ctx.read(home).includes('is running</h1>')
    if (starter) ctx.write('test/home.test.tsx', homeTest)
    else
      ctx.write(
        'test/example.test.ts',
        serverOnly
          ? `import { createTestClient } from '@kitr/testing'\nimport { expect, it } from 'vitest'\nimport { server } from '../server/main'\n\nit('answers health', async () => {\n  const client = createTestClient(server)\n  const res = await client.get<{ ok: boolean }>('/api/health')\n  expect(res.status).toBe(200)\n  expect(res.body.ok).toBe(true)\n})\n`
          : `import { createTestApp } from '@kitr/testing'\nimport { expect, it } from 'vitest'\n\nit('boots the app', async () => {\n  const app = await createTestApp()\n  expect(app.status).toBe('booted')\n})\n`,
      )
    ctx.agents.add(
      'testing',
      `- \`${ctx.pm} test\` runs Vitest. Components: \`renderWithKitr(<X />, { app, queryData })\` from \`@kitr/testing/react\`. APIs: \`createTestClient(server).get('/api/x')\`. No running backend is needed.`,
    )
  },
  remove(ctx) {
    ctx.scripts.remove('test', 'vitest run')
    ctx.agents.remove('testing')
  },
  generators: {
    test: {
      description: 'Create a vitest file in test/',
      definition:
        'An app-level Vitest file; unit tests may also sit beside their file as *.test.ts.',
      // test/, where every kit's vitest config and tsconfig look.
      target: (name, project) => generatorFile(project, 'test', '', name, { suffix: '.test' }),
      stub: ({ name }) => `import { createTestApp } from '@kitr/testing'
import { describe, expect, it } from 'vitest'

describe('${naming.snake(name)}', () => {
  it('boots the app', async () => {
    const app = await createTestApp()
    expect(app.status).toBe('booted')
  })

  // HTTP: \`const client = createTestClient(server)\` with \`server\` from server/main.ts, then
  // \`expect((await client.get('/api/health')).status).toBe(200)\`.
})
`,
    },
  },
})
