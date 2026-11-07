# Entry points

Every `kitr/*` import maps to one `@kitr/*` package. The umbrella `kitr` package is a set of one-line re-exports plus the CLI binary; it has no code of its own.

## The rules

1. **Re-export, never re-implement.** `kitr/router` does `export * from '@tanstack/react-router'`. Nothing upstream is renamed, wrapped or hidden. If a TanStack doc page says `import { Link } from '@tanstack/react-router'`, `import { Link } from 'kitr/router'` is the same thing.
2. **Add beside, never change.** kitr's additions are new names (`createKitrRouter`, `defineQuery`, `useUrlTableState`). The one exception is documented in [departures.md](departures.md): `kitr/forms` exports its own `Form` and re-exports React Hook Form's as `RhfForm`.
3. **Providers are subpaths.** `kitr/query/provider`, `kitr/http/provider`, `kitr/ui/provider`, `kitr/auth/provider` export a provider as `default`, so `kitrrc.ts` can lazy-import them without pulling the rest of the package into the boot path.
4. **Server entries never import React.** `kitr/server`, `kitr/api`, `kitr/logger`, `kitr/socket/server`, `kitr/socket.io/server`, `kitr/auth/server`, `kitr/db` and `kitr/testing` are safe in a Node-only project. `kitr/testing/react` is where `renderWithKitr` lives.
5. **Optional peers.** `kitr` lists every `@kitr/*` package as an optional peer. `kitr add <name>` installs the ones you use; importing an entry whose package is missing fails at build time with a clear module-not-found, not at runtime.

## One exception you will hit

In route files, import `createFileRoute`, `createLazyFileRoute` and the root-route creators from `@tanstack/react-router` directly:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { Link, Outlet } from 'kitr/router'
```

TanStack's route generator rewrites that specific import in every route file and only recognises `@tanstack/react-router` as its source. Everything else in the file comes from `kitr/router`. `kitr doctor` knows about this exception and does not flag it.

## Reading the map

| Entry | Package | React |
| --- | --- | --- |
| `kitr`, `kitr/app` | `@kitr/core` | no |
| `kitr/env` | `@kitr/core` | no |
| `kitr/react` | `@kitr/react` | yes |
| `kitr/router` | `@kitr/router` | yes |
| `kitr/query`, `kitr/query/provider` | `@kitr/query` | yes |
| `kitr/http`, `kitr/http/provider` | `@kitr/http` | no (provider is framework-neutral) |
| `kitr/forms` | `@kitr/forms` | yes |
| `kitr/table` | `@kitr/table` | yes |
| `kitr/state` | `@kitr/state` | yes |
| `kitr/styling` | `@kitr/styling` | no |
| `kitr/tailwind`, `kitr/tailwind/vite`, `kitr/tailwind/preset.css` | `@kitr/tailwind` | no |
| `kitr/ui`, `kitr/ui/provider`, `kitr/ui/styles.css` | `@kitr/ui` | yes |
| `kitr/logger` | `@kitr/logger` | no |
| `kitr/server` | `@kitr/server` | no |
| `kitr/api`, `kitr/api/client` | `@kitr/api` | no |
| `kitr/actions` | `@kitr/actions` | yes (TanStack Start) |
| `kitr/ssr` | `@kitr/ssr` | yes |
| `kitr/socket`, `kitr/socket/server` | `@kitr/socket` | no |
| `kitr/socket.io`, `kitr/socket.io/server` | `@kitr/socket.io` | no |
| `kitr/auth`, `kitr/auth/provider` | `@kitr/auth` | hooks need React; `createAuth` does not |
| `kitr/auth/server` | `@kitr/auth` | no |
| `kitr/db` | `@kitr/db` | no |
| `kitr/testing` | `@kitr/testing` | no |
| `kitr/testing/react` | `@kitr/testing` | yes |
| `kitr/mocks` | `@kitr/mocks` | no |
| `kitr/i18n` | `@kitr/i18n` | yes |
| `kitr/vite` | `@kitr/vite` | no (build time) |
