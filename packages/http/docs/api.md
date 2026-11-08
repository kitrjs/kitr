---
title: API reference
description: Every export of kitr/http.
order: 2
---

# API reference

`kitr/http` re-exports everything from `ky` and adds the following.

## createHttpClient

```ts
function createHttpClient(options?: HttpClientOptions): KyInstance
```

The provider calls this with `config/http.ts` and binds the result as `http` in the container. Call it yourself to talk to a second API.

| Option | Type | Description |
| --- | --- | --- |
| `baseUrl` | `string` | Prefix for relative paths. |
| `getToken` | `() => string \| null \| Promise<...>` | Called before every request; the result is sent as `Authorization: Bearer <token>`. |
| `refresh` | `() => Promise<boolean>` | Called once on a `401`. Return `true` to retry with a fresh token. |
| `onUnauthorized` | `(error: KitrError) => void` | Called when a `401` can't be recovered. |
| `authHeader` | `string` | Header for the token. Default `Authorization` with a `Bearer ` prefix. |
| ...ky options | | Any other [ky option](https://github.com/sindresorhus/ky#options) except `prefixUrl`. |

GET, PUT, HEAD, DELETE, OPTIONS and TRACE requests retry up to twice when ky's defaults allow it (network failures, timeouts, `429` and `5xx` responses).

## httpQuery

```ts
function httpQuery<TInput = void, TOutput = unknown>(
  client: KyInstance | (() => KyInstance),
  options: {
    path: string | ((input: TInput) => string)
    key: (input: TInput) => QueryKey
    searchParams?: (input: TInput) => Record<string, string | number | boolean | undefined>
    schema?: StandardSchemaV1<unknown, TOutput>
    options?: ky.Options
    staleTime?: number
  },
): QueryContract<TInput, TOutput>
```

A `GET` endpoint as a query contract. Pass it to `queryFrom`. `undefined` search params are dropped. Pass `client` as a function, such as `() => app.container.use('http')`, when the module loads before the app boots: it is called on each request.

## httpMutation

```ts
function httpMutation<TInput = void, TOutput = unknown>(
  client: KyInstance | (() => KyInstance),
  options: {
    method?: 'get' | 'post' | 'put' | 'patch' | 'delete' // default 'post'
    path: string | ((input: TInput) => string)
    body?: (input: TInput) => unknown                     // default: the input
    schema?: StandardSchemaV1<unknown, TOutput>
    effects?: CacheEffect | ((result: TOutput, input: TInput) => CacheEffect)
    options?: ky.Options
  },
): MutationContract<TInput, TOutput>
```

An endpoint that changes data, as a mutation contract. Pass it to `mutationFrom`.

## normaliseHttpError

```ts
function normaliseHttpError(error: unknown): Promise<KitrError>
```

Turns a ky `HTTPError`, or anything else, into a `KitrError`. The client already applies it; use it when calling `fetch` yourself.

## defineConfig

```ts
defineConfig(config: HttpClientOptions): HttpClientOptions
```
