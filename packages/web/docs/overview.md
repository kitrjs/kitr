---
title: Overview
description: Ship to the browser as a static site, a single-page app or a server-rendered app, installable if you want.
order: 0
---

# Web

## What it is

`@kitr/web` adds a web platform with a mode: `static`, `spa` or `ssr`. `kitr dev`, `build` and `start` know how to run each. The `pwa` option makes the app installable. A project can run more than one web platform.

For phones add [mobile](/packages/mobile); for a desktop window, [desktop](/packages/desktop) or [tauri](/packages/tauri).

## Install

```sh
kitr add web site
```

Adds `@kitr/web` with TanStack Start, a `site` platform and the `dev`, `build` and `start` scripts. Adds [router](/packages/router) and [react](/packages/react) first if missing. `kitr new` does this for you. [Every change](/packages/web/guide#install).

## Quick start

Replace the home page with an order list:

```tsx
// app/pages/home.tsx
const orders = [
  { id: 'ord_1042', customer: 'Ada', total: 129 },
  { id: 'ord_1043', customer: 'Grace', total: 84 },
]

export default function OrdersPage() {
  return (
    <main>
      <h1>Acme orders</h1>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            {order.id}: {order.customer}, ${order.total}
          </li>
        ))}
      </ul>
    </main>
  )
}
```

Run it:

```sh
kitr dev site
```

Vite starts on `http://localhost:3000/` and you see the two orders. Edits to the file reload the page in place. When it looks right, build it and serve the build:

```sh
kitr build site
kitr start site
# ✔ site: serving dist/site on http://localhost:3000/
```

`kitr build site` writes `dist/site` for the chosen mode, and `kitr start site` serves it the way production will. Next in the guide: [Ship your first page](/packages/web/guide#ship-your-first-page).

## Built on

| Built on | Role |
| --- | --- |
| [Vite](https://vite.dev) through [@kitr/vite](/packages/vite) | The dev server and the build. |
| [TanStack Start](https://tanstack.com/start/latest) | Server rendering, prerendering and the server entry. |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | The service worker and manifest for installable apps. |
| [srvx](https://srvx.h3.dev) | Serving the SSR build on Node, Bun, Deno and Workers. |

kitr adds the platform contract, the three modes, the manifest, the install and update hooks and the deploy defaults.

## Problems it solves

- **Choosing a rendering strategy too early.** [Choose a rendering mode](/packages/web/guide#choose-a-rendering-mode).
- **Marketing pages and the app in one project.** [Run more than one web platform](/packages/web/guide#run-more-than-one-web-platform).
- **An app nobody can install.** [Make the app installable](/packages/web/guide#make-the-app-installable).
- **Users on stale versions.** [updater](/packages/updater).
- **Deploying to a sub-path or a CDN.** [Deploy a static site or SPA to a CDN](/packages/web/guide#deploy-a-static-site-or-spa-to-a-cdn).

## Further reading

- [Guide](/packages/web/guide).
- [API reference](/packages/web/api).
- [TanStack Start documentation](https://tanstack.com/start/latest) and [vite-plugin-pwa](https://vite-pwa-org.netlify.app).
- [SEO](/packages/seo), [Platform](/packages/platform) and [Updater](/packages/updater).
- [Platforms](/docs/platforms).
