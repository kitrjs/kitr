---
title: Testing
description: Test components and API routes with everything already wired up.
order: 1
---

# Testing

The hard part of testing a component is rarely the test. It's setting up the providers, the query cache and the router it expects. `kitr/testing` renders components inside your real app, and sends requests to your API without starting a server.

## Install

```sh
kitr add testing
```

This installs [Vitest](https://vitest.dev), plus Testing Library and happy-dom when the project has a UI. It writes `vitest.config.ts` and an example test. Run the tests with:

```sh
pnpm test
```

Tests live next to the code (`app/**/*.test.tsx`) or under `test/`.

## Components

```tsx
// app/features/projects/project-list.test.tsx
import { screen } from '@testing-library/react'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { expect, it } from 'vitest'
import { ProjectList } from './project-list'

it('lists projects', async () => {
  const app = await createTestApp({ providers, config })
  renderWithKitr(<ProjectList />, {
    app,
    queryData: [[['projects', 'list'], [{ id: '1', name: 'Alpha' }]]],
  })
  expect(await screen.findByText('Alpha')).toBeTruthy()
})
```

`createTestApp` boots an app with `environment: 'test'` and whatever providers and config you pass. The `virtual:kitr/*` modules give you the same ones your app uses; the `kitr()` plugin in `vitest.config.ts` provides them. `renderWithKitr` wraps the component in that app's providers, and `queryData` fills the [query](/packages/query) cache first, so the component renders data without any network.

To test a component that uses links or route hooks, pass a `wrapper` that adds a router with a memory history.

## API routes

```ts
// test/projects.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '../server/main'

it('creates a project', async () => {
  const client = createTestClient(server)
  const res = await client.post<{ id: string }>('/api/projects', { name: 'Alpha' })
  expect(res.status).toBeLessThan(300)
  expect(res.body.id).toBeTruthy()
})

it('rejects a short name', async () => {
  const res = await createTestClient(server).post('/api/projects', { name: 'A' })
  expect(res.status).toBe(422)
})
```

The client calls `server.fetch()` directly, so no port is opened. It also accepts any object with a `fetch(request)` method, or a URL string to test a running deployment. JSON bodies are sent and parsed for you, and `res.response` holds the raw `Response`.

Pass default headers once, for example to sign every request in:

```ts
const client = createTestClient(server, { headers: { authorization: `Bearer ${token}` } })
```

## Faking the API

To test the frontend against an API that doesn't exist yet, or to force an error case, use [mocks](/packages/mocks).
