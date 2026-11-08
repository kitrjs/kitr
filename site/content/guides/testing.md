---
title: Test your app
description: A test suite for a kitr app, from permission rules to a real browser, with a test database and a CI workflow that runs it on every push.
packages: testing, actions, api, query, db
platforms: web, server
time: 40 min
---

# Test your app

A good test suite catches bugs, runs in seconds and never fails for no reason. kitr makes tests fast: API tests need no port, actions run in-process, and components render inside the app's own providers. This guide builds one suite, from the cheapest test to the most expensive, and runs it in CI.

You will test `acme-projects`, the project tracker from [Build a full-stack app](/guides/fullstack-app): a permission rule, the `projects.create` action, the `/api/teams/:teamId/projects` routes against a real Postgres, the new-project form, the projects page, and one browser test that clicks through the built app.

## Before you start

You need the project from [Build a full-stack app](/guides/fullstack-app), or any project made with `kitr new --kit fullstack`. Every kit except `blank` includes [Testing](/packages/testing), so [Vitest](https://vitest.dev), `@testing-library/react` and `happy-dom` are installed and `npm test` already runs:

```sh
npm test
```

```txt
 ✓ test/example.test.ts (1 test) 2ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

In a project without them, `kitr add testing` installs everything and writes `vitest.config.ts`.

## Decide what to test where

Each layer of the app has one cheapest way to test it. Use that one, and keep the slow kinds for what only they can catch:

| What | Test with | Needs | Speed |
| --- | --- | --- | --- |
| Rules, schemas, formatting | Plain Vitest | Nothing | Under 1 ms |
| Server actions | `action.run(input, { context })` | A database, or a fake | A few ms |
| API routes | `createTestClient(server)` | A database, or a fake | A few ms |
| Components | `renderWithKitr(<X />, { app, queryData })` | A DOM (`happy-dom`) | 10 to 50 ms |
| Pages with loaders | The real router, with seeded data or [Mocks](/packages/mocks) | A DOM | 50 to 200 ms |
| The built app in a browser | [Playwright](https://playwright.dev) | A build and a browser | Seconds |

Most of your tests belong in the first three rows. A browser test proves the pieces are wired together; it is a poor way to check that a project name needs two letters.

## Test the rules first

Logic that has no I/O needs no kitr at all. The permission rules in `app/abilities.ts` decide who may rename a project, and a mistake there is a security bug, so they get a test of their own:

```ts
// app/abilities.test.ts
import { describe, expect, it } from 'vitest'
import { abilities, type Project, type User } from '#app/abilities'

const ada: User = { id: 'u_ada', email: 'ada@acme.com', role: 'admin', teamId: 'team_acme' }
const grace: User = { id: 'u_grace', email: 'grace@acme.com', role: 'member', teamId: 'team_acme' }
const roadmap: Project = { id: 'prj_roadmap', ownerId: 'u_ada', teamId: 'team_acme' }

describe('projects.update', () => {
  it('lets admins edit any project', () => {
    expect(abilities.can(ada, 'projects.update', roadmap)).toBe(true)
  })

  it('lets members edit only their own', () => {
    expect(abilities.can(grace, 'projects.update', roadmap)).toBe(false)
    expect(abilities.can(grace, 'projects.update', { ...roadmap, ownerId: 'u_grace' })).toBe(true)
  })

  it('never lets an anonymous visitor in', () => {
    expect(abilities.can(null, 'projects.update', roadmap)).toBe(false)
  })
})
```

The same goes for the zod schema in `app/validators/projects.ts`: `newProjectSchema.safeParse({ teamId: 'team_acme', name: 'A' }).success` is `false`, and that is a one-line test. [Add sign-in, end to end](/guides/authentication) writes these abilities.

## Give the tests their own database

Tests that touch Postgres need a database they may wipe. Never point them at the one you develop against. Create a second database next to it:

```sh
docker exec acme-db createdb -U postgres acme_test
```

Vitest does not read `.env` files into `process.env` on its own. Load `.env.test` in the config, so the server sees `DATABASE_URL` when the first test boots it:

```sh
# .env.test
DATABASE_URL=postgres://postgres:acme@localhost:5432/acme_test
```

```ts
// vitest.config.ts
import { kitr } from '@kitr/vite'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  plugins: [kitr({ plugins: { tailwind: false } })],
  test: {
    environment: 'happy-dom',
    include: ['app/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    env: loadEnv(mode, process.cwd(), ''),
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
  },
}))
```

Under Vitest `mode` is `test`, so `loadEnv` reads `.env` and then `.env.test`, and the third argument `''` loads every variable, not only the `VITE_` ones. `fileParallelism: false` runs test files one after another, because they share one database. That is fast enough for a suite of a few hundred tests; the next section shows how to keep files apart when you want them in parallel again.

Migrate the test database once before the run, in a global setup file:

```ts
// test/global-setup.ts
import { execSync } from 'node:child_process'
import { loadEnv } from 'vite'

export default function setup() {
  const env = { ...process.env, ...loadEnv('test', process.cwd(), '') }
  execSync('pnpm drizzle-kit migrate', { stdio: 'inherit', env })
}
```

`globalSetup` runs once per `npm test`, before any test file, in Vitest's main process. `test.env` only reaches the test files, so the setup loads `.env.test` itself before it runs the migration.

## Reset data between tests

Each test should create the rows it reads and start from an empty table. Truncate before every test in a setup file Vitest runs inside each test file:

```ts
// test/setup.ts
import { sql } from 'drizzle-orm'
import { useDb } from '@kitr/db'
import { beforeEach } from 'vitest'
import type { AppDb } from '#config/db'
import { server } from '#server/main'

beforeEach(async () => {
  await server.boot()
  await useDb<AppDb>(server.app).execute(sql`truncate table projects restart identity cascade`)
})
```

```ts
// vitest.config.ts
// ...
  test: {
    // ...
    setupFiles: ['test/setup.ts'],
  },
```

`server.boot()` runs the providers in `kitrrc.ts` once per file, including [DB](/packages/db), which connects. Reading the client from `server.app` means the tests use the same connection the routes do.

To run files in parallel again, give each Vitest worker its own database instead of truncating a shared one: create and migrate `acme_test_1` to `acme_test_4` in the global setup, then pick one per worker from `process.env.VITEST_POOL_ID` before the server boots.

## Test an action

`.run(input, { context })` validates the input and calls the handler in-process. No server function, no HTTP, no browser. Test what the handler decides: what it returns, and what it refuses:

```ts
// app/actions/projects/create.test.ts
import { beforeAll, describe, expect, it } from 'vitest'
import { createProject } from '#app/actions/projects/create'
import { app } from '#app/app'

beforeAll(() => app.boot())

describe('projects.create', () => {
  it('creates a project and returns it', async () => {
    const project = await createProject.run({ teamId: 'team_acme', name: 'Apollo launch' })
    expect(project).toMatchObject({ teamId: 'team_acme', name: 'Apollo launch' })
    expect(project.id).toMatch(/^prj_/)
  })

  it('refuses a name the team already uses', async () => {
    await createProject.run({ teamId: 'team_acme', name: 'Apollo launch' })
    await expect(createProject.run({ teamId: 'team_acme', name: 'Apollo launch' })).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { name: ['This team already has a project with that name'] },
    })
  })

  it('validates the input before the handler runs', async () => {
    await expect(createProject.run({ teamId: 'team_acme', name: 'A' })).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { name: [expect.any(String)] },
    })
  })
})
```

The handler calls `useRequestApp(app)`. Outside a request that returns `app` from `app/app.ts` itself, so the test boots it first: its providers register, and [DB](/packages/db) connects to the test database from `.env.test`. Without `app.boot()`, the first query fails because nothing has bound the database yet.

An action behind `requireSession` needs a session in its context. `.run()` skips middleware, so pass the context the middleware would have set:

```ts
// app/actions/projects/archive.test.ts
import { expect, it } from 'vitest'
import { archiveProject } from '#app/actions/projects/archive'

it('records who archived the project', async () => {
  const result = await archiveProject.run(
    { id: 'prj_roadmap' },
    { context: { session: { user: { id: 'u_ada' } } } },
  )
  expect(result.archivedBy).toBe('u_ada')
})
```

Middleware itself, such as the session lookup, gets its own test, or is covered by the browser test at the end.

## Test the API

`createTestClient(server)` sends requests to the server's fetch handler. Every provider boots, every middleware runs, and nothing listens on a port:

```ts
// @vitest-environment node
// test/projects-api.test.ts
import { createTestClient } from '@kitr/testing'
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

const client = createTestClient(server)

describe('/api/teams/:teamId/projects', () => {
  it('creates a project and lists it', async () => {
    const created = await client.post<{ id: string }>('/api/teams/team_acme/projects', { name: 'Apollo launch' })
    expect(created.status).toBe(201)

    const list = await client.get<Array<{ name: string }>>('/api/teams/team_acme/projects')
    expect(list.body.map((p) => p.name)).toEqual(['Apollo launch'])
  })

  it('answers 422 with field errors for a short name', async () => {
    const res = await client.post('/api/teams/team_acme/projects', { name: 'A' })
    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({ code: 'VALIDATION', fieldErrors: { name: [expect.any(String)] } })
  })

  it('answers 404 for a project in another team', async () => {
    const res = await client.get('/api/teams/team_acme/projects/prj_missing')
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Project not found', status: 404 })
  })
})
```

The `// @vitest-environment node` line runs the file in Node instead of `happy-dom`, so `Request` and `Response` are the ones your server uses in production. It must come before any import.

Routes behind `authMiddleware` need a token. Sign in through the real route and pass the header once:

```ts
// test/helpers/sign-in.ts
import { createTestClient } from '@kitr/testing'
import { server } from '#server/main'

export async function signedInClient(email: string, password = 'correct horse battery') {
  const res = await createTestClient(server).post<{ token: string }>('/api/sign-in', { email, password })
  if (res.status !== 200) throw new Error(`Sign-in as ${email} failed with ${res.status}`)
  return createTestClient(server, { headers: { authorization: `Bearer ${res.body.token}` } })
}
```

The helper throws with the status when sign-in fails, so a broken seed shows up as "Sign-in as grace@acme.com failed with 401", not as a confusing `403` three lines later.

## Test a component

A component test renders one component inside the app's providers and checks what a person would see. Seed the query cache when the test is about rendering, so nothing touches the network:

```tsx
// app/components/projects/project-list.test.tsx
import { screen } from '@testing-library/react'
import queryProvider from '@kitr/query/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { expect, it } from 'vitest'
import { ProjectList } from '#app/components/projects/project-list'

it('lists the team’s projects', async () => {
  const app = await createTestApp({ providers: [queryProvider] })
  renderWithKitr(<ProjectList teamId="team_acme" />, {
    app,
    queryData: [
      [
        ['action', 'projects.list', { teamId: 'team_acme' }],
        [{ id: 'prj_1', teamId: 'team_acme', name: 'Apollo launch', createdAt: new Date() }],
      ],
    ],
  })

  expect(await screen.findByText('Apollo launch')).toBeTruthy()
})
```

Action queries live under `['action', '<name>', input]`, so the seeded key is the one `useQuery('projects.list', { teamId: 'team_acme' })` reads.

A form test checks what the user sees when they get it wrong. Register the generated operations so `useMutation('projects.create')` resolves, and fill the form the way a person would:

```tsx
// app/components/projects/new-project-form.test.tsx
import { fireEvent, screen } from '@testing-library/react'
import queryProvider from '@kitr/query/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { expect, it } from 'vitest'
import { operations } from '#kitr/actions'
import { NewProjectForm } from './new-project-form'

it('shows the schema’s message under the field', async () => {
  const app = await createTestApp({ providers: [queryProvider], operations })
  renderWithKitr(<NewProjectForm teamId="team_acme" />, { app })

  fireEvent.change(screen.getByLabelText('New project'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create' }))

  expect(await screen.findByText('Give the project a name of at least two letters')).toBeTruthy()
})
```

The schema rejects the name in the browser, so the action is never called and the test needs no server. To test the server's answer, such as the duplicate-name error, the action test above already covers it.

## Test a page

A page test renders the real route table at a URL, runs its loader and checks the result. The `/projects` loader calls a server action through a TanStack Start server function, which needs the Start runtime, so seed the data the loader asks for before the router loads. `ensureQueryData` then finds it in the cache and the page renders without a request:

```tsx
// app/pages/projects/index.test.tsx
import { act, render, screen } from '@testing-library/react'
import queryProvider from '@kitr/query/provider'
import { createKitrRouter, createMemoryHistory, RouterProvider } from '@kitr/router'
import { createTestApp } from '@kitr/testing'
import { expect, it } from 'vitest'
import { routes } from '#app/routes'

it('renders the projects page from its URL', async () => {
  const app = await createTestApp({ providers: [queryProvider] })
  app.container
    .use('queryClient')
    .setQueryData(
      ['action', 'projects.list', { teamId: 'team_acme' }],
      [{ id: 'prj_1', teamId: 'team_acme', name: 'Apollo launch', createdAt: new Date() }],
    )
  const router = createKitrRouter({
    routes,
    app,
    history: createMemoryHistory({ initialEntries: ['/projects'] }),
  })

  await act(async () => {
    render(<RouterProvider router={router} />)
    await router.load()
  })

  expect(await screen.findByRole('heading', { name: 'Projects' })).toBeTruthy()
  expect(screen.getByText('Apollo launch')).toBeTruthy()
})
```

A page whose loader calls an HTTP API instead, as the pages in [Build a dashboard](/guides/dashboard) do, can run its loader for real: answer the requests with `setupNodeMocks` from [Mocks](/packages/mocks) and skip the seeding. Either way, the full round trip from the browser to the database is the browser test's job.

## Test the built app in a browser

One browser test proves the whole chain works: the build, server rendering, hydration, the action round trip and the database. Install [Playwright](https://playwright.dev/docs/intro):

```sh
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

Point it at the production build, served the way production serves it:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'pnpm kitr build && pnpm kitr start site',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_URL: 'postgres://postgres:acme@localhost:5432/acme_test' },
  },
})
```

```ts
// e2e/projects.spec.ts
import { expect, test } from '@playwright/test'

test('a new project appears in the list', async ({ page }) => {
  await page.goto('/projects')
  await page.getByLabel('New project').fill('Apollo launch')
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByRole('listitem').filter({ hasText: 'Apollo launch' })).toBeVisible()
})
```

```sh
pnpm exec playwright test
```

Keep the `e2e/` folder out of Vitest's `include`, which only picks up `app/` and `test/`. Browser tests take seconds each, so write a handful for the paths that make money or lose data, and let the faster layers cover the rest.

## Run it in CI

Run the whole suite on every push. This GitHub Actions workflow starts Postgres as a service, checks types and the project's wiring, runs Vitest, then the browser test:

```yaml
# .github/workflows/test.yml
name: test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: acme
          POSTGRES_DB: acme_test
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:acme@localhost:5432/acme_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm kitr doctor --strict
      - run: pnpm test
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test
```

| Step | What it catches |
| --- | --- |
| `pnpm typecheck` | Runs `kitr types` and then `tsc`, so a renamed action or a removed column fails here first. |
| `kitr doctor --strict` | Providers that do not resolve, a missing config file, an upstream library imported directly where an `@kitr/*` package re-exports it. `--strict` turns warnings into failures. |
| `pnpm test` | Rules, actions, the API, components and pages. |
| `playwright test` | The built app, end to end. |

The variables in the job's `env` reach every step, so `loadEnv` in `vitest.config.ts` and the Playwright web server both see the CI database.

## Next steps

- [Testing](/packages/testing): every option of `createTestApp`, `createTestClient` and `renderWithKitr`.
- [Mocks](/packages/mocks): per-test handlers, error responses and the same mocks in the browser.
- [Actions](/packages/actions#testing): `.run()` and testing components that call actions by name.
- [Deploy to production](/guides/deploy): the build these tests run against, on a real host.
- [Vitest](https://vitest.dev/guide/) and [Playwright](https://playwright.dev/docs/intro) documentation.
