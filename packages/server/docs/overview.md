---
title: Overview
description: Run a Node server that starts, logs and shuts down cleanly.
order: 0
---

# Server

API routes, webhooks from a payment provider, a realtime channel for order updates: anything that runs outside the browser needs a server underneath. A bare HTTP server is a few lines. One that boots providers in order, gives every request an id and a logger, turns thrown errors into clean JSON, answers health checks and drains in-flight requests before it exits is a few hundred, written slightly differently in every project.

`@kitr/server` is that server, and the platform that runs it.

## What it is

`@kitr/server` is `createServer`: an HTTP server that boots your providers, binds services in the container, gives each request an id, a logger and a context you can read from anywhere, turns errors into kitr's JSON shape, limits body sizes, answers `/healthz`, accepts WebSocket connections and shuts down without dropping requests. It is also a platform: `server()` in `kitrrc.ts` tells `kitr dev`, `kitr build` and `kitr start` how to run it.

It runs on the server only and never imports React, so a pure backend built with kitr ships none. Routes and controllers come from [API routes](/packages/api); functions your own UI calls come from [actions](/packages/actions).

## Built on

`@kitr/server` is built on [h3](https://h3.dev), the web-standard HTTP framework, and served by [srvx](https://srvx.h3.dev), so the same server runs on Node, Bun, Deno and Cloudflare Workers, standalone or inside [TanStack Start](https://tanstack.com/start/latest). WebSockets come through [crossws](https://crossws.h3.dev).

kitr adds the provider boot order, the container, the request context and request-scoped services, the request id and [logger](/packages/logger) on every request, the error shape, body limits, health checks, lifecycle hooks and graceful shutdown.

## Problems it solves

- **Boot order nobody controls.** Providers boot in dependency order, and the server listens only when they are ready. See [Start your first server](/packages/server/guide#start-your-first-server).
- **Lost context deep in a service.** `Request` is readable anywhere during a request, with its id and user. See [Read the current request anywhere](/packages/server/guide#read-the-current-request-anywhere).
- **Logs you cannot trace.** Every line a request writes carries its id, across services. See [Log with the request id](/packages/server/guide#log-with-the-request-id).
- **Errors as HTML or stack traces.** Thrown errors become JSON with a code, a message and field errors. See [Return errors as JSON](/packages/server/guide#return-errors-as-json).
- **Deploys that drop requests.** Shutdown waits for in-flight requests and runs your cleanup. See [Shut down without dropping requests](/packages/server/guide#shut-down-without-dropping-requests).
- **One codebase, several runtimes.** The same server runs on Node, Bun, Deno and Workers. See [Choose a runtime](/packages/server/guide#choose-a-runtime).

## Further reading

- [Guide](/packages/server/guide): install, configure and every task.
- [API reference](/packages/server/api): every export with its signature.
- [h3 documentation](https://h3.dev) and [srvx](https://srvx.h3.dev): the framework and the runtime adapter underneath.
- [API routes](/packages/api), [Logger](/packages/logger) and [Realtime](/packages/realtime): what runs on this server.
- [Build an API server without React](/guides/api-server).
