---
title: Mocks
description: Fake your API while you build the frontend or run tests.
order: 1
---

# Mocks

[MSW](https://mswjs.io) handlers generated from your kitr route table, so a mock is one resolver per route name and an unhandled route answers 501 instead of silently passing. The same handlers run in the browser during development and in Node for tests.

## Install

```sh
kitr add mocks
```

## Handlers from the route table

```ts
// app/mocks/handlers.ts
import { mockRoutes, mockValidationError } from 'kitr/mocks'
import { routes } from '#server/routes'

export const handlers = mockRoutes(routes.toJSON(), 'http://localhost:3000', {
  'projects.index': () => [{ id: '1', name: 'Alpha' }],
  'projects.show': ({ params }) => ({ id: params.id, name: 'Alpha' }),
  'projects.store': async ({ body }) => {
    const input = (await body()) as { name?: string }
    if (!input.name) return mockValidationError({ name: ['Name is required'] })
    return { id: '2', ...input }
  },
})
```

A resolver returns the JSON body, a `Response`, or throws a `KitrError`, which `kitrErrorResponse` turns into the same error shape the real server sends. Plain `http` and `HttpResponse` from MSW are re-exported for routes outside the table.

## Development

```ts
// app/client.tsx
if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === 'true') {
  const { setupBrowserMocks } = await import('kitr/mocks')
  const { handlers } = await import('./mocks/handlers')
  await setupBrowserMocks(handlers)
}
```

## Tests

```ts
import { setupNodeMocks } from 'kitr/mocks'

const server = await setupNodeMocks(handlers)
afterAll(() => server.close())
```
