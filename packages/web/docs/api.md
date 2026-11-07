---
title: API
description: Every export of kitr/web, with its signature.
order: 2
---

# API

Every export of `kitr/web`, `kitr/web/client`, `kitr/web/provider`, `kitr/web/vite`, `kitr/web/kitr`, read from the published type definitions. The [guide](/packages/web) shows them in use.

## kitr/web

### pwaManifest

```ts
function pwaManifest(options: WebOptions, appName: string): {
  name: string;
  short_name: string;
  description: string | undefined;
  theme_color: string;
  background_color: string;
  display: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  start_url: string;
  icons: {
    src: string;
    sizes: string;
    type?: string;
    purpose?: string;
  }[];
};
```

The manifest vite-plugin-pwa gets, from `web({ pwa })` and the app name.

### startWeb

```ts
function startWeb(ctx: PlatformContext, options: {
  mode: WebMode;
  port: number;
  host: string;
  base?: string;
}): Promise<void>;
```

Serve a built web platform: the Start server bundle for `ssr`, static files otherwise.

### staticFiles

```ts
function staticFiles(serveStatic: (options: {
  dir: string;
  maxAge?: number;
  immutable?: boolean;
}) => unknown, dir: string, base?: string): StaticHandler;
```

Static files for a built web platform, under the platform's `base`. Vite's hashed files in
`assets/` never change, so they are cached for a year; everything else (`index.html`, `sw.js`,
the manifest, `public/` files) keeps its name across deploys and is revalidated on every load,
or users would be stuck on an old release.

### web

```ts
const web: import("@kitr/core").PlatformFactory<WebOptions>;
```

The web platform. List it in kitrrc.ts under `platforms`:

```ts
platforms: { site: web({ mode: 'ssr', pwa: true, port: 3000 }) }
```
`kitr dev site` starts Vite, `kitr build site` writes `dist/site`, `kitr start site` serves it.

### PwaOptions

```ts
interface PwaOptions {
  /** Full app name in the install dialog. Default: the app name from package.json. */
  name?: string;
  /** Name under the home-screen icon. Default: `name`, then the app name. */
  shortName?: string;
  /** Manifest description. */
  description?: string;
  /** Browser UI color. Default `#0f172a`. */
  themeColor?: string;
  /** Splash screen background. Default `#ffffff`. */
  backgroundColor?: string;
  /** How the installed app opens. Default `standalone`. */
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  /** Page the installed app opens on. Default `/`. */
  startUrl?: string;
  /** Manifest icons. Default `/icons/icon-192.png` and `/icons/icon-512.png` (maskable). */
  icons?: Array<{
    src: string;
    sizes: string;
    type?: string;
    purpose?: string;
  }>;
  /** `autoUpdate` reloads on a new version; `prompt` lets `useServiceWorker()` show a banner. Default `prompt`. */
  registerType?: 'autoUpdate' | 'prompt';
  /** Enable the service worker in `kitr dev`. Default false. */
  devEnabled?: boolean;
  /** Raw vite-plugin-pwa options merged last. */
  plugin?: Record<string, unknown>;
}
```

The manifest and service worker settings of an installable web platform, passed as `web({ pwa: { ... } })`.

### WebOptions

```ts
interface WebOptions {
  /**
   * `ssr`: TanStack Start renders on the server (needs a Node-ish host).
   * `static`: every route is prerendered at build time to plain HTML, served from any CDN.
   * `spa`: one shell, client rendering, served from any static host. Default `spa`.
   */
  mode: WebMode;
  /** Dev server and production port. Default 3000. */
  port: number;
  /** Interface to bind. Default: Vite's (localhost) in dev, `0.0.0.0` for `kitr start`. */
  host?: string;
  /** Installable app: manifest and service worker. `true` uses the app name; an object sets the manifest. */
  pwa: boolean | PwaOptions;
  /** Public base path, for apps served under a sub-path. Default `/`. */
  base: string;
  /** Open the browser on `kitr dev`. Default false. */
  open: boolean;
}
```

Options of the web platform, as written in `web({ ... })` in kitrrc.ts and edited by `kitr config <name>`.

### WebMode

```ts
type WebMode = 'static' | 'spa' | 'ssr';
```

How a web platform renders: prerendered HTML (`static`), a client-rendered shell (`spa`) or per-request server rendering (`ssr`).

## kitr/web/client

### useInstallPrompt

```ts
function useInstallPrompt(): {
  canInstall: boolean;
  installed: boolean;
  install: () => Promise<"unavailable" | "accepted" | "dismissed">;
};
```

Captures the browser's install prompt so the app can show its own button.
`canInstall` is false on browsers that do not fire the event (Safari) and after install.

### useServiceWorker

```ts
function useServiceWorker(options?: {
  path?: string;
  onNeedRefresh?: () => void;
}): {
  needRefresh: boolean;
  offlineReady: boolean;
  update: () => void;
  registration: ServiceWorkerRegistration | null;
};
```

Registers the service worker vite-plugin-pwa emits (`/sw.js`) and reports a waiting update.
With `registerType: 'prompt'`, call `update()` to activate it and reload.

## kitr/web/provider

### webProvider

```ts
const webProvider: import("@kitr/core").KitrProvider;
```

Runtime provider of the web platform. Registers the `platform` driver that tells
`kitr/platform` the app runs in a browser (or on the server rendering for one).

## kitr/web/vite

### kitrPwa

```ts
function kitrPwa(options: WebOptions, appName: string): Promise<Plugin[]>;
```

vite-plugin-pwa configured from `web({ pwa })`. The kitr() Vite plugin adds it when the
running web platform has `pwa` on; call it yourself only for a custom Vite setup.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
