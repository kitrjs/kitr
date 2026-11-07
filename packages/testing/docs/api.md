---
title: API reference
description: Every export of kitr/testing, with its signature.
order: 2
---

# API reference

Every export of `kitr/testing`, `kitr/testing/react`, read from the published type definitions. The [guide](/packages/testing) shows them in use.

## kitr/testing

### createApp

```ts
function createApp(options?: CreateAppOptions): KitrApp;
```

Creates the app object that owns the container, config and providers. Call `boot()` on it
before reading services; one app per client, per server process and per test.

### createTestApp

```ts
function createTestApp(options?: CreateAppOptions): Promise<KitrApp>;
```

Creates and boots an app for one test, with `environment: 'test'` and the providers and config
you pass. Use it to read services from the container or to render components with `renderWithKitr`.

### createTestClient

```ts
function createTestClient(target: {
  fetch(request: Request): Promise<Response>;
} | string, defaults?: {
  headers?: Record<string, string>;
}): {
  get: <T = unknown>(path: string, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
  post: <T = unknown>(path: string, body?: unknown, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
  put: <T = unknown>(path: string, body?: unknown, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
  patch: <T = unknown>(path: string, body?: unknown, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
  delete: <T = unknown>(path: string, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
};
```

Request helper for API tests against anything with `fetch(request)`: a kitr server, a Start
handler, or a real URL. It sends JSON, parses JSON back and adds `defaults.headers` to every call,
without opening a port when given a handler.

### TestResponse

```ts
interface TestResponse<T = unknown> {
  /** The HTTP status code, such as `201` or `422`. */
  status: number;
  /** The response headers. */
  headers: Headers;
  /** The body parsed as JSON; the raw text when it is not JSON; `undefined` when it is empty. */
  body: T;
  /** The raw `Response`. Its body has already been read. */
  response: Response;
}
```

What every `createTestClient` call resolves to: the status, headers and parsed body of one response.

## kitr/testing/react

### createApp

```ts
function createApp(options?: CreateAppOptions): KitrApp;
```

Creates the app object that owns the container, config and providers. Call `boot()` on it
before reading services; one app per client, per server process and per test.

### createTestApp

```ts
function createTestApp(options?: CreateAppOptions): Promise<KitrApp>;
```

Creates and boots an app for one test, with `environment: 'test'` and the providers and config
you pass. Use it to read services from the container or to render components with `renderWithKitr`.

### createTestClient

```ts
function createTestClient(target: {
  fetch(request: Request): Promise<Response>;
} | string, defaults?: {
  headers?: Record<string, string>;
}): {
  get: <T = unknown>(path: string, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
  post: <T = unknown>(path: string, body?: unknown, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
  put: <T = unknown>(path: string, body?: unknown, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
  patch: <T = unknown>(path: string, body?: unknown, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
  delete: <T = unknown>(path: string, init?: {
    headers?: Record<string, string>;
  }) => Promise<TestResponse<T>>;
};
```

Request helper for API tests against anything with `fetch(request)`: a kitr server, a Start
handler, or a real URL. It sends JSON, parses JSON back and adds `defaults.headers` to every call,
without opening a port when given a handler.

### renderWithKitr

```ts
function renderWithKitr(ui: ReactElement, { app, queryData, wrapper: Extra, ...options }: RenderWithKitrOptions): import("@testing-library/react").RenderResult<typeof import("@testing-library/dom/types/queries"), HTMLElement, HTMLElement>;
```

Render inside the same providers the app uses, with the query cache pre-seeded.
Pass a `wrapper` to add a router (e.g. `RouterProvider` with a memory history).

### RenderWithKitrOptions

```ts
interface RenderWithKitrOptions extends Omit<RenderOptions, 'wrapper'> {
  /** The booted app whose providers wrap the component, usually from `createTestApp`. */
  app: KitrApp;
  /** Seed the query cache: `[[['projects', 'detail', '1'], project]]`. Needs @kitr/query's provider. */
  queryData?: Array<[
    readonly unknown[],
    unknown
  ]>;
  /** An extra wrapper rendered inside the app's providers, such as a router with a memory history. */
  wrapper?: (props: {
    children: ReactNode;
  }) => ReactElement;
}
```

Options for `renderWithKitr`: Testing Library's render options plus the app, cache seed and an extra wrapper.

### TestResponse

```ts
interface TestResponse<T = unknown> {
  /** The HTTP status code, such as `201` or `422`. */
  status: number;
  /** The response headers. */
  headers: Headers;
  /** The body parsed as JSON; the raw text when it is not JSON; `undefined` when it is empty. */
  body: T;
  /** The raw `Response`. Its body has already been read. */
  response: Response;
}
```

What every `createTestClient` call resolves to: the status, headers and parsed body of one response.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
