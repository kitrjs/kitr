---
title: Overview
description: Fake your API while you build the frontend or run tests.
order: 0
---

# Mocks

## What it is

`@kitr/mocks` fakes your API. Write a handler per endpoint, or hand `mockRoutes()` your route table, and the app's real HTTP client gets realistic responses, including errors in the shape a kitr server sends. Turn them on in development with `VITE_MOCKS=true`, or in Vitest with `setupNodeMocks()`.

Runs in the browser and in tests. To test your own API routes, use [testing](/packages/testing).

## Install

```sh
kitr add mocks
```

Adds `@kitr/mocks` and MSW, `app/mocks/handlers.ts`, the service worker in `public/` and `VITE_MOCKS=false` in `.env.example`. No provider. [Every change](/packages/mocks/guide#install).

## Quick start

Add a handler for the request your screen makes:

```ts
// app/mocks/handlers.ts
import { HttpResponse, http } from '@kitr/mocks'

export const handlers = [
  http.get('*/api/me', () =>
    HttpResponse.json({ id: 'u_ada', email: 'ada@acme.com', name: 'Ada', role: 'admin' }),
  ),
  http.get('*/api/invoices', () =>
    HttpResponse.json([
      { id: 'inv_1001', customer: 'Grace', amount: 120, status: 'paid' },
      { id: 'inv_1002', customer: 'Linus', amount: 300, status: 'open' },
    ]),
  ),
]
```

Set `VITE_MOCKS=true`, restart `kitr dev`, and the page shows the two invoices. The network panel says `from service worker`. `*` matches any origin. Next in the guide: [Fake your first endpoint](/packages/mocks/guide#fake-your-first-endpoint).

## Built on

kitr adds `mockRoutes()`, error responses in kitr's shape and the two setup helpers.

## Problems it solves

- **Building screens before the API exists.** [Fake your first endpoint](/packages/mocks/guide#fake-your-first-endpoint).
- **Writing one handler per route by hand.** [Mock a whole route table](/packages/mocks/guide#mock-a-whole-route-table).
- **Error states that are hard to reach.** [Send an error response](/packages/mocks/guide#send-an-error-response).
- **Tests that hit the network.** [Use mocks in tests](/packages/mocks/guide#use-mocks-in-tests).
- **Third-party APIs in development.** [Mock a third-party API](/packages/mocks/guide#mock-a-third-party-api).

## Further reading

- [Guide](/packages/mocks/guide).
- [API reference](/packages/mocks/api).
- [MSW docs](https://mswjs.io/docs).
- [Testing](/packages/testing), [API](/packages/api) and [HTTP](/packages/http).
