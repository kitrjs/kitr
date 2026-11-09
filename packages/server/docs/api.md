---
title: API reference
description: Every export of @kitr/server.
order: 2
---

# API reference

## createServer

```ts
function createServer(options?: {
  providers?: ProviderInput[] // usually rc.providers
  config?: Record<string, unknown> // per-package config, keyed by package
  env?: Record<string, unknown>    // validated env from createEnv, exposed as app.env
  server?: ServerConfig           // shortcut for config.server
  app?: KitrApp                   // reuse an app you created
  logger?: Logger
}): KitrServer
```

## KitrServer

| Member | Description |
| --- | --- |
| `listen({ port?, host? })` | Boot, start a standalone server and run providers' `ready`. Resolves to `{ url, close() }`. Handles `SIGINT` and `SIGTERM`. |
| `fetch(request)` | Web-standard handler. Boots on first call. |
| `boot()` | Run `register` and `boot` for every provider. |
| `close()` | Run providers' `shutdown`. |
| `mount(base, handler)` | Mount an h3 app or anything with `fetch` under a path. |
| `use(middleware)` | Add h3 middleware. |
| `app` | The kitr app: `container`, `config`, lifecycle. |
| `h3` | The underlying h3 instance. |
| `logger` | The root logger. |
| `config` | Resolved server config. |

## Request context

```ts
useRequest(): RequestContext          // throws outside a request
tryUseRequest(): RequestContext | undefined
useRequestApp(fallback?): KitrApp     // the request's container fork
runWithRequest(ctx, fn)               // for custom adapters

interface RequestContext {
  event: H3Event
  app: KitrApp
  requestId: string
  logger: Logger
  startedAt: number
  locals: Record<string, unknown>
}
```

## Errors

```ts
errorToResponse(error, event?): Response
normaliseServerError(error): KitrError
```

## defineConfig

```ts
defineConfig(config: ServerConfig): ServerConfig
```

See [the options table](/packages/server/guide#configure).
