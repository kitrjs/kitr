# Entry points

Every `kitr/*` import maps to one `@kitr/*` package. The umbrella `kitr` package is a set of one-line re-exports plus the CLI binary; it has no code of its own.

## The rules

1. **Re-export, never re-implement.** `kitr/router` does `export * from '@tanstack/react-router'`. Nothing upstream is renamed, wrapped or hidden. If a TanStack doc page says `import { Link } from '@tanstack/react-router'`, `import { Link } from 'kitr/router'` is the same thing.
2. **Add beside, never change.** kitr's additions are new names (`createKitrRouter`, `queryFrom`, `useUrlTableState`). The one exception is documented in [departures.md](departures.md): `kitr/forms` exports its own `Form` and re-exports React Hook Form's as `RhfForm`.
3. **Providers are subpaths.** `kitr/query/provider`, `kitr/http/provider`, `kitr/theme/provider`, `kitr/auth/provider` export a provider as `default`, so `kitrrc.ts` can lazy-import them without pulling the rest of the package into the boot path.
4. **Server entries never import React.** `kitr/server`, `kitr/api`, `kitr/logger`, `kitr/realtime/server`, `kitr/realtime/socket.io/server`, `kitr/realtime/sse/server`, `kitr/auth/server`, `kitr/db` and `kitr/testing` are safe in a Node-only project. `kitr/testing/react` is where `renderWithKitr` lives.
5. **Platforms are packages.** `kitr/web`, `kitr/server`, `kitr/desktop`, `kitr/tauri` and `kitr/mobile` each export a factory built with `definePlatform` from `@kitr/core`. The core knows the contract, never a platform.
6. **Optional peers.** `kitr` lists every `@kitr/*` package as an optional peer, so installing `kitr` installs none of them. `kitr add <name>` installs the ones you use. Importing an entry whose package is missing stops the Vite plugin in dev and build with `kitr/<name> re-exports @kitr/<name>, which is not installed. Run \`kitr add <name>\`.`, and `kitr doctor` reports the same. Without the plugin, Node says `Cannot find package '@kitr/<name>'`, and Vite on its own turns a missing optional peer into a misleading missing-export error or an error thrown in the browser, which is why the plugin checks first.

## Route-table extensions are subpaths

`kitr/router/routes`, `kitr/api/routes` and `kitr/realtime/routes` each export one extension as `default`, for the list in `defineRoutes([...])`. Importing `kitr/api/routes` into `server/routes.ts` never pulls React in; importing `kitr/router/routes` into `app/routes.ts` never pulls h3 in. A package that adds route methods ships them this way and names the module in its `routes` field, so `kitr add` can keep the list current.

## One exception, for projects still on file routes

A project that kept `app/routes/__root.tsx` imports `createFileRoute`, `createLazyFileRoute` and the root-route creators from `@tanstack/react-router` directly:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { Link, Outlet } from 'kitr/router'
```

TanStack's route generator rewrites that specific import in every route file and only recognises `@tanstack/react-router` as its source. Everything else in the file comes from `kitr/router`. `kitr doctor` knows about this exception and does not flag it. A table project has no route files, so nothing in it imports `@tanstack/react-router`.

## Reading the map

| Entry | Package | React |
| --- | --- | --- |
| `kitr`, `kitr/app` | `@kitr/core` | no |
| `kitr/env` | `@kitr/core` | no |
| `kitr/react` | `@kitr/react` | yes |
| `kitr/router`, `kitr/router/stack` | `@kitr/router` | yes |
| `kitr/query`, `kitr/query/provider` | `@kitr/query` | yes |
| `kitr/http`, `kitr/http/provider` | `@kitr/http` | no (provider is framework-neutral) |
| `kitr/forms` | `@kitr/forms` | yes |
| `kitr/table` | `@kitr/table` | yes |
| `kitr/animation`, `kitr/animation/provider`, `kitr/animation/page-transitions.css` | `@kitr/animation` | yes |
| `kitr/3d`, `kitr/3d/drei` | `@kitr/3d` | yes |
| `kitr/state` | `@kitr/state` | yes |
| `kitr/tailwind`, `kitr/tailwind/vite`, `kitr/tailwind/preset.css` | `@kitr/tailwind` | no |
| `kitr/theme`, `kitr/theme/provider`, `kitr/theme/styles.css` | `@kitr/theme` | yes |
| `kitr/theme/server` | `@kitr/theme` | no |
| `kitr/logger` | `@kitr/logger` | no |
| `kitr/server`, `kitr/server/platform` | `@kitr/server` | no |
| `kitr/api`, `kitr/api/client` | `@kitr/api` | no |
| `kitr/actions` | `@kitr/actions` | yes (TanStack Start) |
| `kitr/seo` | `@kitr/seo` | no |
| `kitr/realtime`, `kitr/realtime/client`, `kitr/realtime/socket.io`, `kitr/realtime/sse` | `@kitr/realtime` | no |
| `kitr/realtime/server`, `kitr/realtime/socket.io/server`, `kitr/realtime/sse/server` | `@kitr/realtime` | no |
| `kitr/realtime/react` | `@kitr/realtime` | yes |
| `kitr/auth`, `kitr/auth/provider` | `@kitr/auth` | hooks need React; `createAuth` does not |
| `kitr/auth/server` | `@kitr/auth` | no |
| `kitr/db` | `@kitr/db` | no |
| `kitr/testing` | `@kitr/testing` | no |
| `kitr/testing/react` | `@kitr/testing` | yes |
| `kitr/mocks` | `@kitr/mocks` | no |
| `kitr/i18n`, `kitr/i18n/provider` | `@kitr/i18n` | yes |
| `kitr/analytics`, `kitr/analytics/provider` | `@kitr/analytics` | no |
| `kitr/analytics/react` | `@kitr/analytics` | yes |
| `kitr/monitoring`, `kitr/monitoring/provider`, `kitr/monitoring/server` | `@kitr/monitoring` | no |
| `kitr/platform`, `kitr/platform/provider` | `@kitr/platform` | no |
| `kitr/platform/react`, `kitr/platform/devtools` | `@kitr/platform` | yes |
| `kitr/offline`, `kitr/offline/provider` | `@kitr/offline` | no |
| `kitr/offline/react` | `@kitr/offline` | yes |
| `kitr/flags`, `kitr/flags/provider`, `kitr/flags/server` | `@kitr/flags` | no |
| `kitr/flags/react` | `@kitr/flags` | yes |
| `kitr/consent`, `kitr/consent/provider` | `@kitr/consent` | no |
| `kitr/consent/react` | `@kitr/consent` | yes |
| `kitr/secure-storage`, `kitr/secure-storage/provider` | `@kitr/secure-storage` | no |
| `kitr/secure-storage/react` | `@kitr/secure-storage` | yes |
| `kitr/files`, `kitr/files/provider` | `@kitr/files` | no |
| `kitr/files/react` | `@kitr/files` | yes |
| `kitr/notifications`, `kitr/notifications/provider` | `@kitr/notifications` | no |
| `kitr/notifications/react` | `@kitr/notifications` | yes |
| `kitr/native`, `kitr/native/provider` | `@kitr/native` | no |
| `kitr/native/react` | `@kitr/native` | yes |
| `kitr/updater`, `kitr/updater/provider` | `@kitr/updater` | no |
| `kitr/updater/react` | `@kitr/updater` | yes |
| `kitr/cache`, `kitr/cache/provider` | `@kitr/cache` | no |
| `kitr/shield`, `kitr/shield/provider` | `@kitr/shield` | no |
| `kitr/mail`, `kitr/mail/provider` | `@kitr/mail` | templates are React elements; sending needs react-dom/server |
| `kitr/jobs`, `kitr/jobs/provider` | `@kitr/jobs` | no |
| `kitr/uploads`, `kitr/uploads/server`, `kitr/uploads/provider` | `@kitr/uploads` | no |
| `kitr/uploads/react` | `@kitr/uploads` | yes |
| `kitr/storage`, `kitr/storage/provider`, `kitr/storage/server` | `@kitr/storage` | no |
| `kitr/storage/react` | `@kitr/storage` | yes |
| `kitr/devtools`, `kitr/devtools/provider` | `@kitr/devtools` | no (`kitr/devtools/ui` is React) |
| `kitr/web`, `kitr/web/vite` | `@kitr/web` | no (CLI and build time) |
| `kitr/web/client`, `kitr/web/provider` | `@kitr/web` | hooks need React |
| `kitr/desktop`, `kitr/desktop/main`, `kitr/desktop/preload` | `@kitr/desktop` | no |
| `kitr/desktop/client`, `kitr/desktop/provider` | `@kitr/desktop` | no |
| `kitr/tauri` | `@kitr/tauri` | no (CLI) |
| `kitr/tauri/client`, `kitr/tauri/provider` | `@kitr/tauri` | `useTauriEvent` needs React |
| `kitr/mobile` | `@kitr/mobile` | no (CLI) |
| `kitr/mobile/client`, `kitr/mobile/provider` | `@kitr/mobile` | no |
| `kitr/vite` | `@kitr/vite` | no (build time) |
