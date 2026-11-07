---
title: Web
description: Ship to the browser as a static site, a single-page app or a server-rendered app, installable if you want.
order: 1
---

# Web

The web platform runs your `app/` in a browser. One line in `kitrrc.ts` says how:

```ts
import { web } from 'kitr/web'

export default defineKitrConfig({
  platforms: {
    site: web({ mode: 'ssr', pwa: true }),
  },
})
```

## Modes

| `mode` | What you get |
| --- | --- |
| `static` | Every route prerendered to an HTML file at build time. Host it anywhere. |
| `spa` | One HTML shell and client-side routing. The default. |
| `ssr` | Pages rendered on the server for each request through TanStack Start, then hydrated. |

All three are the same build through TanStack Start, so switching is a one-word change: `kitr config site mode ssr`.

## Install

```sh
kitr add web site
```

Every kit already has a web platform called `site`. Adding one installs `@kitr/web`, needs the [router](/packages/router), writes `platforms.site` into `kitrrc.ts`, and adds `dev`, `build` and `start` scripts that run `kitr dev`, `kitr build` and `kitr start`.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `spa` | `static`, `spa` or `ssr` |
| `port` | `3000` | Dev and production port |
| `host` | | Bind address (`localhost` in dev, `0.0.0.0` in production) |
| `pwa` | `false` | `true` or `{ name, shortName, themeColor, backgroundColor, display }` for an installable app with a manifest and a service worker |
| `base` | `/` | Public base path |
| `open` | `false` | Open the browser on `kitr dev` |

Change any of them with `kitr config site <option> <value>`, or at run time with `KITR_SITE_<OPTION>=...`.

## Installable apps

With `pwa: true` the build writes a web manifest and a service worker (vite-plugin-pwa, auto-updating). `kitr/web/client` gives the hooks:

```tsx
import { useInstallPrompt, useServiceWorker } from 'kitr/web/client'

function InstallButton() {
  const install = useInstallPrompt()
  if (!install.canInstall) return null
  return <button onClick={() => install.install()}>Add to home screen</button>
}
```

`useServiceWorker()` tells you when a new version is waiting so you can offer a reload.

## Output

`kitr build site` writes `dist/site/client` (static assets, and the HTML files for `static` and `spa`) and, for `ssr`, `dist/site/server/server.js`. `kitr start site` serves it with srvx on the configured port. The [SEO](/packages/seo) package adds the prerender list, sitemap and `robots.txt`.
