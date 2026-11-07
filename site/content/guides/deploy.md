---
title: Deploy to production
description: Build a kitr app, set its environment, run migrations and ship it as static files, one Node process, a Docker image or a Cloudflare Worker.
packages: web, server, db, logger
platforms: web, server
time: 30 min
---

# Deploy to production

Deploying is three questions: what does the build produce, what does it need at run time, and what runs it. kitr answers the first two the same way for every app, so the third is a choice of host, not a rewrite. Static pages go to a CDN, a server-rendered app runs as one Node process, an API can also run on Bun, Deno or Cloudflare Workers.

This guide ships `acme-projects`, the app from [Build a full-stack app](/guides/fullstack-app), to `app.acme.com`: server-rendered pages and the `/api` routes from one process, Postgres migrated before each release, configuration from the environment, and a Docker image any container host can run. It ends with the other shapes: a static site, a separate API, and Workers.

## Before you start

You need a kitr project that builds locally. Check it the way CI will:

```sh
pnpm typecheck
pnpm kitr doctor --strict
pnpm test
```

`kitr doctor --strict` fails on anything that would break at run time: a provider in `kitrrc.ts` that does not resolve, a config file a package needs, a dependency missing from `package.json`, React imported into a server-only project. Fix those before you build. [Test your app](/guides/testing) sets up the whole pipeline in GitHub Actions.

## Build the app

```sh
pnpm kitr build
```

`kitr build` builds every platform in `kitrrc.ts`, in order, into `dist/<name>/`. What lands there depends on the platform:

| Platform | Output | Run it with |
| --- | --- | --- |
| `web({ mode: 'static' })` | `dist/site/client/`: one HTML file per route, plus assets | Any static file host |
| `web({ mode: 'spa' })` | `dist/site/client/`: one HTML shell, plus assets | Any static host that rewrites unknown paths to the shell |
| `web({ mode: 'ssr' })` | `dist/site/client/` for assets and `dist/site/server/server.js`, a fetch handler | `kitr start site` |
| `server()` on Node, Bun or Deno | Nothing to bundle: the build typechecks `server/main.ts` | `kitr start api` |
| `server({ runtime: 'workers' })` | `dist/api/`: the bundled Worker | `wrangler deploy` |

For `acme-projects` the build writes `dist/site/client` and `dist/site/server/server.js`, and typechecks the API. Try it before you ship anything:

```sh
pnpm kitr start site
```

```txt
✔ site: serving dist/site on http://localhost:3000/
```

`kitr start site` serves the assets in `dist/site/client` and hands every other request to the server bundle. Because the fullstack kit wrote `app/server.ts`, Start's server entry, which passes every path in `server/routes.ts` to the server in `server/main.ts`, this one process serves the pages and the API. `curl http://localhost:3000/api/health` answers `{"ok":true}`.

## Set the environment

Configuration comes from the environment, validated by `app/env.ts` when the app starts. There are two kinds of variables, and they reach the app at different times:

| Kind | Example | Read when | Where it is set |
| --- | --- | --- | --- |
| Public (`VITE_` prefix) | `VITE_APP_NAME` | At build time, written into the browser bundle | The environment of `kitr build` |
| Server | `DATABASE_URL`, `LOG_LEVEL` | At start time, from `process.env` | The environment of `kitr start` |

Declare each one in `app/env.ts`, so a missing value fails the start instead of the first request that needs it:

```ts
// app/env.ts
import { createEnv, env as e } from 'kitr/env'

export const env = createEnv({
  public: {
    VITE_APP_NAME: e.string({ default: 'Acme Projects' }),
  },
  server: {
    DATABASE_URL: e.url(),
    LOG_LEVEL: e.enum(['debug', 'info', 'warn', 'error'], { default: 'info' }),
  },
})
```

Started without `DATABASE_URL`, the server stops before it listens and prints one message listing every problem:

```txt
Error: [kitr/env] Invalid environment variables:
  DATABASE_URL: required
```

> **Warning**
> Every `VITE_` variable is copied into JavaScript that anyone can download. Never give a secret, such as an API key or a database password, the `VITE_` prefix. Reading a server variable in the browser throws, so a mistake shows up in development.

Two variables are read by kitr itself: `PORT` and `HOST` set where `kitr start` listens, over the `port` and `host` options in `kitrrc.ts`. Most hosts set `PORT` for you. To change any platform option for one run without editing `kitrrc.ts`, set `KITR_<NAME>_<OPTION>`, such as `KITR_SITE_PORT=8080`.

`.env` files are for development. In production, set variables in the host's dashboard or the container's environment, and keep `.env` out of the image.

## Run migrations before the new version starts

The new code expects the new schema, so migrate first and start second. With [Drizzle](https://orm.drizzle.team/docs/migrations), the migrations `drizzle-kit generate` wrote into `server/db/migrations` are part of the release:

```sh
pnpm drizzle-kit migrate
pnpm kitr start site
```

Run the migration as its own step, once per release: a release command on Fly, a pre-deploy command on Render or Railway, an init container on Kubernetes. Running it inside every instance's start command works for one instance, but two instances starting together race to apply the same migration.

Write migrations the old code can live with. While the release rolls out, old and new instances run side by side against the new schema, so add a column in one release and drop the old one in the next.

## Ship it as a Docker image

A container runs the same way on every host that takes one. This Dockerfile builds in one stage and runs in a smaller one:

```dockerfile
# Dockerfile
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NODE_ENV=production
RUN pnpm kitr build

FROM node:22-slim
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "kitr", "start", "site"]
```

```txt
# .dockerignore
node_modules
dist
.env
.env.*
.git
```

The runtime stage keeps the whole project, `node_modules` included, because `kitr start` reads `kitrrc.ts` and the API runs from its TypeScript source through `tsx`. That costs some image size and saves you from a second install that can drift from the first.

Build it, then run it the way the host will, with the environment passed in:

```sh
docker build -t acme-projects .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://postgres:acme@host.docker.internal:5432/acme \
  acme-projects
```

On `SIGTERM`, which every container host sends before it stops a container, the kitr server stops taking new connections, lets running requests finish, runs every provider's `shutdown` (DB closes its pool), and exits. `config/server.ts` sets how long it waits with `shutdownTimeout`, in seconds; after that it exits with code 1.

## Pick a host

Any host that runs a container, or runs `pnpm kitr start site` with Node 22, runs this app. What changes between them is where you set variables and where the migration step goes:

| Host type | Examples | Run | Migrations |
| --- | --- | --- | --- |
| Container platforms | Fly.io, Railway, Render, Coolify, Google Cloud Run | The Dockerfile above | The host's release or pre-deploy command |
| A virtual machine | Any Linux server | `pnpm kitr start site` under systemd or pm2, behind a proxy for TLS | A step in your deploy script |
| Static hosts | Cloudflare Pages, Netlify, S3 with CloudFront | `dist/site/client` only, for `static` and `spa` modes | Not applicable |
| Edge workers | Cloudflare Workers | The `api` platform with `runtime: 'workers'` | A separate step against your database |

Health checks: point the host at `/api/health`, the route the kit wrote in `server/routes.ts`. A separate API server also answers `/healthz` on its own port, the kitr server's built-in health route.

## Deploy a static site

A `static` or `spa` web platform has no server: upload `dist/site/client` and you are done. A static build renders every route to HTML at build time, so `/pricing` is `pricing/index.html` and needs no configuration. A SPA has one HTML shell, so the host must answer every unknown path with it and let the router take over. On Netlify:

```txt
# public/_redirects
/*  /index.html  200
```

With nginx, the same rule is `try_files $uri $uri/ /index.html;`. Without it, reloading `/projects/prj_roadmap` answers 404. Check the shell's file name in `dist/site/client` after a build and use that name.

Data in a static site is whatever existed at build time. Anything that changes after the build, such as a list of open jobs, must be fetched in the browser, or the site rebuilt when it changes.

## Run the API on its own

When the API serves more than this one site, such as a mobile app and partners, run it as its own process and scale it apart from the pages. The `api` platform starts on its own:

```sh
pnpm kitr start api
```

`kitr start api` runs `server/main.ts` on port 3001, or `PORT`. Point the site at it with `VITE_API_URL` at build time, and allow the site's origin with `cors` from [API routes](/packages/api) or [Shield](/packages/shield), since the browser now calls another origin.

The API runs on other runtimes without code changes. Set the runtime in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { server } from 'kitr/server'

export default defineKitrConfig({
  // ...packages and providers
  platforms: {
    api: server({ runtime: 'bun' }),
  },
})
```

| Runtime | `kitr start api` runs | Notes |
| --- | --- | --- |
| `node` (default) | `node --import tsx server/main.ts` | Needs `tsx` installed, so keep dev dependencies in the image. |
| `bun` | `bun server/main.ts` | Bun runs TypeScript itself. |
| `deno` | `deno run -A server/main.ts` | `-A` grants every permission; narrow it in your own start script. |
| `workers` | `wrangler dev` locally | Deploy with `wrangler deploy`; see the next section. |

## Deploy the API to Cloudflare Workers

Workers run the server's fetch handler at the edge, with no process to keep alive. Switch the runtime and rescaffold the platform:

```sh
pnpm kitr config api runtime workers
pnpm kitr platforms scaffold api
```

The scaffold writes `platforms/api/wrangler.toml`, which points at `server/main.ts` and turns on Node compatibility:

```toml
# platforms/api/wrangler.toml
name = "acme-projects-api"
main = "../../server/main.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
```

`kitr build api` bundles the Worker into `dist/api` without deploying it, which catches a dependency that cannot run on Workers. Deploy from the platform folder:

```sh
pnpm kitr build api
cd platforms/api && pnpm exec wrangler deploy
```

Set secrets with `wrangler secret put DATABASE_URL`. A Worker has no long-lived process, so use a database driver that works over HTTP or through [Hyperdrive](https://developers.cloudflare.com/hyperdrive/), and keep realtime channels on a Node, Bun or Deno server.

## Run more than one instance

One instance is the right start. When you add a second, two things change:

- Realtime: each instance only knows its own WebSocket connections, so an event emitted on one never reaches clients connected to another. [Add live updates](/guides/live-updates) explains the options before you scale.
- Anything kept in memory, such as the default rate limit store in [Shield](/packages/shield), counts per instance. Move it to a shared store, or accept that the limit is per instance.

Sessions in a signed cookie or a database work on any number of instances without change.

## Next steps

- [Platforms](/docs/platforms): every option of `web()` and `server()`, and `kitr dev`, `build` and `start`.
- [Test your app](/guides/testing): the CI pipeline that should pass before every deploy.
- [Server](/packages/server): `config/server.ts`, the health route, request logging and graceful shutdown.
- [Logger](/packages/logger): JSON logs in production and where to send them.
- [Monitoring](/packages/monitoring): error reports from the browser and the server.
