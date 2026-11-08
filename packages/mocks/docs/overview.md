---
title: Overview
description: Fake your API while you build the frontend or run tests.
order: 0
---

# Mocks

Frontend work shouldn't wait for the backend. The invoices screen is designed, the API that feeds it is still a ticket, and the tests for its empty and error states need answers the real server rarely gives. Hard-coding fake data into components is quick and then has to be removed again.

`@kitr/mocks` answers your app's HTTP requests with fake data, in the browser while you develop and in Node while your tests run, without touching the components.

## What it is

`@kitr/mocks` is a set of request handlers that intercept `fetch`. You write a handler per endpoint, or hand `mockRoutes()` your kitr route table and only write the answers, and the app's real HTTP client gets realistic responses: lists, single records, validation errors in exactly the shape a kitr server sends them, slow responses and failures. `setupBrowserMocks()` turns them on in development; `setupNodeMocks()` turns them on in Vitest.

It runs on the client and in tests. It cannot answer requests the server makes while rendering a page, because those never reach the browser. To test your own API routes rather than fake them, use [testing](/packages/testing)'s `createTestClient`.

## Built on

`@kitr/mocks` is [Mock Service Worker](https://mswjs.io) (MSW), with `http` and `HttpResponse` re-exported unchanged. In the browser a service worker intercepts requests; in Node, MSW patches the global `fetch`. Everything in MSW's docs, including GraphQL and WebSocket handlers, works as written.

kitr adds `mockRoutes()`, which turns a kitr route table into one handler per named route; `kitrErrorResponse` and `mockValidationError`, which send errors the way [server](/packages/server) does so [forms](/packages/forms) and error screens behave as in production; and the two setup helpers wired to `kitrrc.ts`.

## Problems it solves

- **Building screens before the API exists.** Fake the endpoints and build against them; delete the handlers when the real ones ship. See [Fake your first endpoint](/packages/mocks/guide#fake-your-first-endpoint).
- **Writing one handler per route by hand.** `mockRoutes()` reads the route table and asks you only for the data. See [Mock a whole route table](/packages/mocks/guide#mock-a-whole-route-table).
- **Error states that are hard to reach.** Send a 422 with field errors, a 500 or a timeout on demand. See [Send an error response](/packages/mocks/guide#send-an-error-response) and [Simulate a slow or failed request](/packages/mocks/guide#simulate-a-slow-or-failed-request).
- **Tests that hit the network.** The same handlers run in Node, and one test can override a handler. See [Use mocks in tests](/packages/mocks/guide#use-mocks-in-tests).
- **Third-party APIs in development.** Mock Stripe or a maps API the same way. See [Mock a third-party API](/packages/mocks/guide#mock-a-third-party-api).

## Further reading

- [Guide](/packages/mocks/guide): install, configure and every task.
- [API reference](/packages/mocks/api): every export of `@kitr/mocks`.
- [MSW docs](https://mswjs.io/docs): handlers, response helpers, GraphQL and WebSocket mocking.
- [Testing](/packages/testing), [API](/packages/api) and [HTTP](/packages/http): the test helpers, the route table `mockRoutes` reads, and the client that turns responses back into errors.
