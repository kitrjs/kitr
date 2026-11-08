---
title: Overview
description: Test components and API routes with everything already wired up.
order: 0
---

# Testing

The hard part of testing an app is rarely the assertion. It is the setup: the providers a component expects, the query cache, the router, a server listening on a port, a fake for the one service that calls a third party. Each test file rebuilds a little of the app, and the little versions drift from the real one.

`@kitr/testing` boots your real app for each test, renders components inside its providers and calls your API without opening a port.

## What it is

`@kitr/testing` is three helpers. `createTestApp()` boots an app with your real providers and config, with any service swapped for a fake. `createTestClient()` sends JSON requests to anything with a `fetch(request)` method, so API tests call the handler directly, sign in with a header, and read typed responses. `renderWithKitr()` from `@kitr/testing/react` renders a component inside that app with the query cache already seeded. `kitr add testing` sets up Vitest and the test environments.

It runs in your test process only, never in the app bundle. `@kitr/testing` has no React in it, so a backend without React uses it as is. To fake an API your frontend calls, rather than test your own, use [mocks](/packages/mocks) alongside it.

## Built on

`@kitr/testing` is built on [Vitest](https://vitest.dev) and [Testing Library](https://testing-library.com/docs/react-testing-library/intro/). Matchers, module mocking, timers and coverage come from Vitest; queries like `getByRole` come from Testing Library. kitr adds the three helpers, the request client with typed responses and error assertions, the per-file environment choice (Node for API tests, jsdom for components) and the isolation between tests.

## Problems it solves

- **Rebuilding the app in every test.** `createTestApp()` boots the real providers and config. See [Boot the app without a server](/packages/testing/guide#boot-the-app-without-a-server).
- **API tests that open ports.** `createTestClient()` calls the fetch handler in-process. See [Send requests to your API](/packages/testing/guide#send-requests-to-your-api).
- **Third parties in tests.** Replace one service with a fake and keep the rest real. See [Replace a service with a fake](/packages/testing/guide#replace-a-service-with-a-fake).
- **Components that need six providers.** `renderWithKitr()` wraps them in the app. See [Render a component](/packages/testing/guide#render-a-component).
- **Loading spinners in snapshots.** Seed the query cache so the component renders with data. See [Seed the query cache](/packages/testing/guide#seed-the-query-cache).
- **Asserting error shapes by hand.** Typed helpers for validation and error responses. See [Assert validation errors](/packages/testing/guide#assert-validation-errors).

## Further reading

- [Guide](/packages/testing/guide): install, configure and every task.
- [API reference](/packages/testing/api): every export of `@kitr/testing` and `@kitr/testing/react`.
- [Vitest docs](https://vitest.dev/guide/) and [Testing Library queries](https://testing-library.com/docs/queries/about): the tools underneath.
- [Mocks](/packages/mocks) and [API](/packages/api): the fake API for the frontend, and the routes these tests call.
- [Test a kitr app](/guides/testing): the guide that tests the full-stack app end to end.
