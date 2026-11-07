---
title: Testing
description: Test components and API routes with everything already wired up.
order: 1
---

# Testing

A booted app for tests, a request client for API routes, and a render helper that wraps components in the same providers the app uses. Vitest runs it all; `kitr make:test <name>` writes a starter file.

## Install

```sh
kitr add testing
```

## API routes

```ts
import { createTestApp, createTestClient } from 'kitr/testing'
import { server } from '#server/main'

const client = createTestClient(server, { headers: { authorization: 'Bearer test' } })

it('lists projects', async () => {
  const res = await client.get<Project[]>('/api/projects')
  expect(res.status).toBe(200)
  expect(res.body).toHaveLength(2)
})
```

`createTestClient` takes anything with `fetch(request)` (a kitr server, a Start handler) or a URL, and parses JSON bodies. `createTestApp({ providers, config })` boots an app in the `test` environment so providers that start timers or connections stay quiet.

## Components

```tsx
import { renderWithKitr } from 'kitr/testing/react'

const app = await createTestApp({ providers: [queryProvider] })
renderWithKitr(<ProjectCard id="1" />, {
  app,
  queryData: [[['projects', 'detail', '1'], { id: '1', name: 'Alpha' }]],
})
expect(screen.getByText('Alpha')).toBeInTheDocument()
```

`queryData` seeds the cache so components using `useSuspenseQuery` render without a network. Pass `wrapper` to add a router with a memory history.

## Fakes

Most packages export an in-memory driver for tests: `createMemoryStorageDriver`, `memoryAdapter` (analytics), `memoryReporter` (monitoring), `createLogTransport` (mail), `createMemoryJobsDriver`, `createMemoryUploadsDriver`, `createMemoryFilesDriver`, `createMemoryNotificationsDriver`, `createMemoryUpdaterDriver`. Pass them through `config` and assert on what they recorded.
