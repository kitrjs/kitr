# @kitr/core

## 0.9.0

### Patch Changes

- a69b7b0: Actions now work in a production build of a full-stack app. `kitr types` writes one literal `createServerFn` chain per action, `@kitr/actions/vite` empties each `handler` in the browser bundle so server code and its imports stay out, and `useRequestApp()` needs no argument inside a request (`runWithApp(app, fn)` covers tests and scripts). The registry accepts callable action definitions, the web platform always installs `srvx`, the realtime package installs `partysocket`, the db provider stays out of the browser, the app's document gets a title, the generated Biome config passes on a fresh project, and the desktop template writes `publish: null` until you configure an update feed.
  
  A single-page app renders its shell from scratch instead of hydrating it, so an unknown URL no longer logs a hydration error; `import.meta.env.KITR_RENDER` tells the client entry which of `ssr`, `static` or `spa` it is.

## 0.8.0

No changes in this release.

## 0.7.0

No changes in this release.

## 0.6.0

No changes in this release.

## 0.5.0

No changes in this release.

## 0.4.0

No changes in this release.

## 0.3.2

### Patch Changes

- 8904b74: An app can hook its own step into `kitr generate`: list it under `generate` in `kitrrc.ts`, as `{ name: 'content', run: 'node scripts/content.mjs', watch: ['content/**'] }` or with `run: () => import('./scripts/content')`. App steps run after the type generators and the package steps in `kitr generate`, `kitr dev`, `kitr build` and `kitr typecheck`; `kitr generate --check` skips them like the package steps, and the new `kitr generate --quiet` shows a step's output only when it fails. `kitr doctor` lists each step.

## 0.3.1

No changes in this release.

## 0.3.0

No changes in this release.

## 0.2.1

No changes in this release.

## 0.2.0

### Minor Changes

- 1206461: Devtools rebuilt: a bottom sheet on phones and a dock on desktops, light and dark themes, a draggable trigger with a long-press menu, a command palette, a three-finger gesture and a URL flag. The hub gains channels, counts, marks and burst collapse; `@kitr/devtools/ui` is a shared kit for contributed panels; `@kitr/http` logs every request and adds a Network panel; the other panels are rewritten on the kit.
- c7e8330: Initial release: the kitr framework, CLI, component registry and example kits.
- 3edf81d: Smaller browser bundles. A package can mark its provider `provider: { client: false }` and `@kitr/vite` leaves it out of the browser's provider list (cache, jobs, shield and uploads do); the devtools panels of every provider are dropped from production builds that do not ship `@kitr/devtools`. `kitr dev` names the generated type files it wrote with paths relative to the project.
