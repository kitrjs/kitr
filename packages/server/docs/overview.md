---
title: Overview
description: Run a Node server that starts, logs and shuts down cleanly.
order: 0
---

# Server

## What it is

`@kitr/server` is `createServer`: an HTTP server that boots your providers, gives each request an id and a logger, turns errors into JSON, answers `/healthz` and shuts down without dropping requests. `server()` in `kitrrc.ts` makes it a platform for `kitr dev`, `build` and `start`.

Runs on the server only. Routes come from [API routes](/packages/api).

## Install

```sh
kitr add server api
```

Adds `@kitr/server` with h3 and srvx, an `api` platform, `config/server.ts`, `server/main.ts` and an empty `server/routes.ts`. Adds [logger](/packages/logger) first if missing. [Every change](/packages/server/guide#install).

## Quick start

`kitr add` wrote the entry. Add one route below `createServer`:

```ts
// server/main.ts
import { createServer } from '@kitr/server'
import { config } from '../config'
import rc from '../kitrrc'

export const server = createServer({ providers: rc.providers, config })

/** Fetch handler for runtimes that call it (Cloudflare Workers, Deno Deploy). */
export default server

server.h3.get('/api/orders/latest', () => ({ id: 'ord_1042', customer: 'Ada', total: 129 }))
```

Start it and ask for the order:

```sh
kitr dev api
curl -i http://localhost:3001/api/orders/latest
```

```http
HTTP/1.1 200 OK
content-type: application/json;charset=UTF-8
x-request-id: 3106a213-994f-4363-b099-eb8c19dc7299

{"id":"ord_1042","customer":"Ada","total":129}
```

The object became JSON and the response carries a request id. For more than a couple of routes, use [api](/packages/api). Next in the guide: [Start your first server](/packages/server/guide#start-your-first-server).

## Built on

kitr adds the boot order, the container, the request context, request ids and logging, the error shape, body limits, health checks and graceful shutdown.

## Problems it solves

- **Boot order nobody controls.** [Start your first server](/packages/server/guide#start-your-first-server).
- **Lost context deep in a service.** [Read the current request anywhere](/packages/server/guide#read-the-current-request-anywhere).
- **Logs you cannot trace.** [Log with the request id](/packages/server/guide#log-with-the-request-id).
- **Errors as HTML or stack traces.** [Return errors as JSON](/packages/server/guide#return-errors-as-json).
- **Deploys that drop requests.** [Shut down without dropping requests](/packages/server/guide#shut-down-without-dropping-requests).
- **One codebase, several runtimes.** [Choose a runtime](/packages/server/guide#choose-a-runtime).

## Further reading

- [Guide](/packages/server/guide).
- [API reference](/packages/server/api).
- [h3 documentation](https://h3.dev) and [srvx](https://srvx.h3.dev).
- [API routes](/packages/api), [Logger](/packages/logger) and [Realtime](/packages/realtime).
- [Build an API server without React](/guides/api-server).
