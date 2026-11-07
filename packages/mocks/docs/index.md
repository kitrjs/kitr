---
title: Mocks
description: Fake your API while you build the frontend or run tests.
order: 1
---

# Mocks

Frontend work shouldn't have to wait for the backend. `kitr/mocks` answers your app's API requests with fake data, in the browser while you develop and in Node while tests run. It is [Mock Service Worker](https://mswjs.io) with helpers for kitr's routes and errors.

## Install

```sh
kitr add mocks
```

This installs `@kitr/mocks` and `msw`. It writes `app/mocks/handlers.ts` and `app/mocks/browser.ts`, and adds `VITE_MOCKS=false` to `.env`.

## Write handlers

```ts
// app/mocks/handlers.ts
import { HttpResponse, http } from 'kitr/mocks'

export const handlers = [
  http.get('*/api/me', () => HttpResponse.json({ id: 'u1', email: 'dev@example.com' })),
  http.get('*/api/projects', () => HttpResponse.json([{ id: '1', name: 'Alpha' }])),
]
```

`http` and `HttpResponse` are MSW's own, so [its docs](https://mswjs.io/docs) apply.

## In the browser

Set `VITE_MOCKS=true` and start the mocks before the app boots:

```ts
if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === 'true') {
  const { enableMocks } = await import('#app/mocks/browser')
  await enableMocks()
}
```

Requests without a handler go to the real network, so you can fake one endpoint and keep the rest.

## In tests

```ts
import { setupNodeMocks } from 'kitr/mocks'
import { afterAll } from 'vitest'
import { handlers } from '#app/mocks/handlers'

const mocks = await setupNodeMocks(handlers)
afterAll(() => mocks.close())
```

Use `mocks.use(...)` inside one test to override a handler for that test only.

## Mock a whole API

With the [API](/packages/api) package, `mockRoutes` builds a handler for every route in your route table. You only fill in the routes you care about, by name:

```ts
import { mockRoutes } from 'kitr/mocks'
import { routes } from '#server/routes'

export const handlers = mockRoutes(routes.toJSON(), 'http://localhost:3000', {
  'projects.index': () => [{ id: '1', name: 'Alpha' }],
  'projects.show': ({ params }) => ({ id: params.id, name: 'Alpha' }),
})
```

A route with no mock answers 501 with "No mock for projects.update", so a gap is loud instead of silent. Return `undefined` for a 204, a `Response` for full control, or throw a `KitrError` to send an error.

## Error cases

`mockValidationError` returns a kitr validation error, which is the easiest way to check that a form shows server errors under the right fields:

```ts
import { mockValidationError } from 'kitr/mocks'

mocks.use(mockValidationError('post', '*/api/projects', { name: ['Already taken'] }))
```

`kitrErrorResponse(error)` turns any `KitrError` into the same response the real server would send.
