# Entry points

Apps import each package by its own name: `@kitr/query`, `@kitr/router/routes`, `@kitr/theme/styles.css`. The `kitr` package is the CLI plus the `kitrrc.ts` config (`kitr/app`, `kitr/env`, both from `@kitr/core`).

## The rules

1. **Re-export, never re-implement.** `@kitr/router` does `export * from '@tanstack/react-router'`. Every upstream name is available unchanged. If a TanStack doc page says `import { Link } from '@tanstack/react-router'`, `import { Link } from '@kitr/router'` is the same thing.
2. **Add beside, never change.** kitr's additions are new names (`createKitrRouter`, `queryFrom`, `useUrlTableState`). The one exception is `@kitr/forms`, which exports its own `Form` and re-exports React Hook Form's as `RhfForm`.
3. **Providers are subpaths.** `@kitr/query/provider`, `@kitr/http/provider`, `@kitr/theme/provider`, `@kitr/auth/provider` export a provider as `default`, so `kitrrc.ts` can lazy-import them.
4. **Server entries never import React.** `@kitr/server`, `@kitr/api`, `@kitr/logger`, `@kitr/realtime/server`, `@kitr/realtime/socket.io/server`, `@kitr/realtime/sse/server`, `@kitr/auth/server`, `@kitr/db` and `@kitr/testing` are safe in a Node-only project. `@kitr/testing/react` is where `renderWithKitr` lives.
5. **Platforms are packages.** `@kitr/web`, `@kitr/server`, `@kitr/desktop`, `@kitr/tauri` and `@kitr/mobile` each export a factory built with `definePlatform` from `@kitr/core`.
6. **You import what you installed.** `kitr add <name>` puts `@kitr/<name>` in `package.json`, and code imports it under that same name. A package that is not installed is a plain `Cannot find module '@kitr/<name>'` in the editor, in `tsc` and in the build.

## Route-table extensions are subpaths

`@kitr/router/routes`, `@kitr/api/routes` and `@kitr/realtime/routes` each export one extension as `default`, for the list in `defineRoutes([...])`. Import `@kitr/api/routes` in `server/routes.ts` and `@kitr/router/routes` in `app/routes.ts`. A package that adds route methods ships them this way and names the module in its `routes` field, so `kitr add` can keep the list current.

## Reading the map

| Entry | React |
| --- | --- |
| `kitr`, `kitr/app` (from `@kitr/core`) | no |
| `kitr/env` (from `@kitr/core`) | no |
| `@kitr/react` | yes |
| `@kitr/router`, `@kitr/router/stack` | yes |
| `@kitr/query`, `@kitr/query/provider` | yes |
| `@kitr/http`, `@kitr/http/provider` | no (provider is framework-neutral) |
| `@kitr/forms` | yes |
| `@kitr/table` | yes |
| `@kitr/animation`, `@kitr/animation/provider`, `@kitr/animation/page-transitions.css` | yes |
| `@kitr/3d`, `@kitr/3d/drei` | yes |
| `@kitr/state` | yes |
| `@kitr/tailwind`, `@kitr/tailwind/vite`, `@kitr/tailwind/preset.css` | no |
| `@kitr/theme`, `@kitr/theme/provider`, `@kitr/theme/styles.css` | yes |
| `@kitr/theme/server` | no |
| `@kitr/logger` | no |
| `@kitr/server`, `@kitr/server/platform` | no |
| `@kitr/api`, `@kitr/api/client` | no |
| `@kitr/actions` | yes (TanStack Start) |
| `@kitr/seo` | no |
| `@kitr/realtime`, `@kitr/realtime/client`, `@kitr/realtime/socket.io`, `@kitr/realtime/sse` | no |
| `@kitr/realtime/server`, `@kitr/realtime/socket.io/server`, `@kitr/realtime/sse/server` | no |
| `@kitr/realtime/react` | yes |
| `@kitr/auth`, `@kitr/auth/provider` | hooks need React; `createAuth` does not |
| `@kitr/auth/server` | no |
| `@kitr/db` | no |
| `@kitr/testing` | no |
| `@kitr/testing/react` | yes |
| `@kitr/mocks` | no |
| `@kitr/i18n`, `@kitr/i18n/provider` | yes |
| `@kitr/analytics`, `@kitr/analytics/provider` | no |
| `@kitr/analytics/react` | yes |
| `@kitr/monitoring`, `@kitr/monitoring/provider`, `@kitr/monitoring/server` | no |
| `@kitr/platform`, `@kitr/platform/provider` | no |
| `@kitr/platform/react`, `@kitr/platform/devtools` | yes |
| `@kitr/offline`, `@kitr/offline/provider` | no |
| `@kitr/offline/react` | yes |
| `@kitr/flags`, `@kitr/flags/provider`, `@kitr/flags/server` | no |
| `@kitr/flags/react` | yes |
| `@kitr/consent`, `@kitr/consent/provider` | no |
| `@kitr/consent/react` | yes |
| `@kitr/secure-storage`, `@kitr/secure-storage/provider` | no |
| `@kitr/secure-storage/react` | yes |
| `@kitr/files`, `@kitr/files/provider` | no |
| `@kitr/files/react` | yes |
| `@kitr/notifications`, `@kitr/notifications/provider` | no |
| `@kitr/notifications/react` | yes |
| `@kitr/native`, `@kitr/native/provider` | no |
| `@kitr/native/react` | yes |
| `@kitr/updater`, `@kitr/updater/provider` | no |
| `@kitr/updater/react` | yes |
| `@kitr/cache`, `@kitr/cache/provider` | no |
| `@kitr/shield`, `@kitr/shield/provider` | no |
| `@kitr/mail`, `@kitr/mail/provider` | templates are React elements; sending needs react-dom/server |
| `@kitr/jobs`, `@kitr/jobs/provider` | no |
| `@kitr/uploads`, `@kitr/uploads/server`, `@kitr/uploads/provider` | no |
| `@kitr/uploads/react` | yes |
| `@kitr/storage`, `@kitr/storage/provider`, `@kitr/storage/server` | no |
| `@kitr/storage/react` | yes |
| `@kitr/devtools`, `@kitr/devtools/provider` | no (`@kitr/devtools/ui` is React) |
| `@kitr/web`, `@kitr/web/vite` | no (CLI and build time) |
| `@kitr/web/client`, `@kitr/web/provider` | hooks need React |
| `@kitr/desktop`, `@kitr/desktop/main`, `@kitr/desktop/preload` | no |
| `@kitr/desktop/client`, `@kitr/desktop/provider` | no |
| `@kitr/tauri` | no (CLI) |
| `@kitr/tauri/client`, `@kitr/tauri/provider` | `useTauriEvent` needs React |
| `@kitr/mobile` | no (CLI) |
| `@kitr/mobile/client`, `@kitr/mobile/provider` | no |
| `@kitr/vite` | no (build time) |
