---
title: Overview
description: Ship to the browser as a static site, a single-page app or a server-rendered app, installable if you want.
order: 0
---

# Web

A marketing page that must load fast from a CDN, a dashboard behind a login, a store that needs every product page indexed: each one ships to the browser in a different way, and choosing late usually means a rewrite. Making the app installable adds a service worker, a manifest and an update flow on top.

`@kitr/web` is the web platform. One line in `kitrrc.ts` says how your `app/` ships, and whether people can install it.

## What it is

`@kitr/web` adds a web platform to `kitrrc.ts` with a mode: `static` prerenders HTML at build time, `spa` builds a single-page app, `ssr` renders on the server. `kitr dev`, `kitr build` and `kitr start` know how to run each, `kitr config` edits the options and `kitr doctor` checks the setup. The `pwa` option makes the app installable, and `useInstallPrompt` and `useServiceWorker` in `@kitr/web/client` drive your own install button and update flow. A project can run more than one web platform, such as a static marketing site and an SSR app.

The platform options run in the CLI and the Vite plugin; the hooks run in the browser. To ship the same app to phones, add [mobile](/packages/mobile); for a desktop window, [desktop](/packages/desktop) or [tauri](/packages/tauri); for an API with no UI, the [server](/packages/server) platform.

## Built on

| Built on | Role |
| --- | --- |
| [Vite](https://vite.dev) through [@kitr/vite](/packages/vite) | The dev server and the build. |
| [TanStack Start](https://tanstack.com/start/latest) | Server rendering, prerendering and the server entry. |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | The service worker and manifest for installable apps. |
| [srvx](https://srvx.h3.dev) | Serving the SSR build on Node, Bun, Deno and Workers. |

kitr adds the platform contract, the three modes, the manifest from `kitrrc.ts`, the install and update hooks, static file serving and the deploy defaults.

## Problems it solves

- **Choosing a rendering strategy too early.** Switch `static`, `spa` and `ssr` in config, not in code. See [Choose a rendering mode](/packages/web/guide#choose-a-rendering-mode).
- **Marketing pages and the app in one project.** Run two web platforms with different modes. See [Run more than one web platform](/packages/web/guide#run-more-than-one-web-platform).
- **An app nobody can install.** The `pwa` option adds the manifest and service worker. See [Make the app installable](/packages/web/guide#make-the-app-installable).
- **Users on stale versions.** Offer an update when a new worker is waiting, with [updater](/packages/updater) for the banner. See [Offer an update when a new version ships](/packages/web/guide#offer-an-update-when-a-new-version-ships).
- **Deploying to a sub-path or a CDN.** Base path, static output and the server build each have a documented path. See [Deploy a static site or SPA to a CDN](/packages/web/guide#deploy-a-static-site-or-spa-to-a-cdn).

## Further reading

- [Guide](/packages/web/guide): install, configure and every task.
- [API reference](/packages/web/api): every export with its signature.
- [TanStack Start documentation](https://tanstack.com/start/latest) and [vite-plugin-pwa](https://vite-pwa-org.netlify.app): rendering and installability underneath.
- [SEO](/packages/seo), [Platform](/packages/platform) and [Updater](/packages/updater): head tags and prerender lists, where the app runs, and the update banner.
- [Platforms](/docs/platforms): every platform type and the commands they share.
