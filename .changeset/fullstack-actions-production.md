---
'@kitr/actions': minor
'@kitr/core': patch
'@kitr/server': minor
'@kitr/db': patch
'@kitr/web': patch
'@kitr/realtime': patch
'@kitr/router': patch
'@kitr/desktop': patch
'@kitr/cli': patch
'@kitr/vite': minor
---

Actions now work in a production build of a full-stack app. `kitr types` writes one literal `createServerFn` chain per action, `@kitr/actions/vite` empties each `handler` in the browser bundle so server code and its imports stay out, and `useRequestApp()` needs no argument inside a request (`runWithApp(app, fn)` covers tests and scripts). The registry accepts callable action definitions, the web platform always installs `srvx`, the realtime package installs `partysocket`, the db provider stays out of the browser, the app's document gets a title, the generated Biome config passes on a fresh project, and the desktop template writes `publish: null` until you configure an update feed.

A single-page app renders its shell from scratch instead of hydrating it, so an unknown URL no longer logs a hydration error; `import.meta.env.KITR_RENDER` tells the client entry which of `ssr`, `static` or `spa` it is.
