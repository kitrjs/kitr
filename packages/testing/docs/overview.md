---
title: Overview
description: Test components and API routes with everything already wired up.
order: 0
---

# Testing

## What it is

`@kitr/testing` is three helpers. `createTestApp()` boots your real providers with any service faked. `createTestClient()` calls your API with no port. `renderWithKitr()` renders a component inside the app with the query cache seeded. `kitr add testing` sets up Vitest.

Runs in your test process only. To fake an API the frontend calls, use [mocks](/packages/mocks).

## Install

```sh
kitr add testing
```

Adds `@kitr/testing` and Vitest, `vitest.config.ts` and an example test. No provider. [Every change](/packages/testing/guide#install).

## Quick start

The server is a fetch handler, so the test client calls it directly:

```ts
// test/orders.test.ts
import { createTestClient } from '@kitr/testing'
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

describe('orders', () => {
  it('creates an order and reads it back', async () => {
    const client = createTestClient(server)

    const created = await client.post<{ id: string; status: string }>('/api/orders', {
      customer: 'Grace',
      total: 120,
    })
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('open')

    const read = await client.get<{ customer: string }>(`/api/orders/${created.body.id}`)
    expect(read.body.customer).toBe('Grace')
  })
})
```

Run it:

```sh
pnpm test
```

```txt
 ✓ test/orders.test.ts (1 test) 31ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

The first request boots the app exactly as `kitr dev` does. Nothing listens on a port, so tests run in parallel. Next in the guide: [Write your first test](/packages/testing/guide#write-your-first-test).

## Built on

kitr adds the three helpers, typed responses, error assertions and the per-file environment choice.

## Problems it solves

- **Rebuilding the app in every test.** [Boot the app without a server](/packages/testing/guide#boot-the-app-without-a-server).
- **API tests that open ports.** [Send requests to your API](/packages/testing/guide#send-requests-to-your-api).
- **Third parties in tests.** [Replace a service with a fake](/packages/testing/guide#replace-a-service-with-a-fake).
- **Components that need six providers.** [Render a component](/packages/testing/guide#render-a-component).
- **Loading spinners in snapshots.** [Seed the query cache](/packages/testing/guide#seed-the-query-cache).
- **Asserting error shapes by hand.** [Assert validation errors](/packages/testing/guide#assert-validation-errors).

## Further reading

- [Guide](/packages/testing/guide).
- [API reference](/packages/testing/api).
- [Vitest docs](https://vitest.dev/guide/) and [Testing Library queries](https://testing-library.com/docs/queries/about).
- [Mocks](/packages/mocks) and [API](/packages/api).
- [Test a kitr app](/guides/testing).
