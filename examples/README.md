# Examples

Each example is the unmodified output of a CLI kit, with `kitr`/`@kitr/*` pointed at the workspace and the per-project `biome.json` removed so the root config applies.

| Directory | Command | Try |
| --- | --- | --- |
| `backend/` | `kitr new backend --kit server` | `pnpm dev`, then `curl localhost:3000/api/health` |
| `dashboard/` | `kitr new dashboard --kit app` | `pnpm dev` |
| `fullstack/` | `kitr new fullstack --kit fullstack` | `pnpm build && pnpm start` (SSR on `/`, API on `/api/health`) |
| `saas/` | `kitr new saas --kit saas` | `pnpm build && pnpm start`, sign in with any email and the password `password`, then create a project |
| `site/` | `kitr new site --kit site` | `pnpm build` prerenders `/`, `/pricing`, `/blog` and every post into `dist/client`; `pnpm start` serves them plus the newsletter API |
| `realtime/` | `kitr new realtime --kit realtime` | `pnpm build && pnpm start`, open two tabs and chat: messages arrive over `/api/ws` |
| `desktop/` | `kitr new desktop --kit desktop` | `pnpm dev` in a browser, `pnpm electron:dev` for the Electron window with native dialogs |
| `mobile/` | `kitr new mobile --kit mobile` | `pnpm build && pnpm preview` for the installable PWA; `pnpm cap add ios` then `pnpm cap:ios` for the native shell |

The last five are presets: the same base as `app`/`fullstack` plus real pages, controllers and tests that show the packages working together. They are the fastest way to see what a package does, and `kitr new --kit <preset>` gives you the same files to start from.

Regenerate one from the repo root:

```sh
node packages/kitr/bin/kitr.mjs new examples/<name> --kit <kit> --no-install --no-git --registry $PWD/registry/dist
```

Then point `kitr` and every `@kitr/*` dependency in the new `package.json` at `workspace:*`, rename the package to `@kitr/example-<name>`, delete its `biome.json` and run `pnpm install`.
