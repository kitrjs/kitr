# Examples

Each example is the unmodified output of a CLI kit, with `kitr`/`@kitr/*` pointed at the workspace and the per-project `biome.json` removed so the root config applies.

| Directory | Command | Try |
| --- | --- | --- |
| `blank/` | `kitr new blank --kit blank` | No dev server: the blank kit has no platform. Run `kitr add web site` first, then `pnpm dev` |
| `backend/` | `kitr new backend --kit server` | `pnpm dev` (`kitr dev api`), then `curl localhost:3001/api/health` |
| `app/` | `kitr new app --kit app` | `pnpm dev`: the smallest kit, two pages and a test |
| `dashboard/` | `kitr new dashboard --kit dashboard` | `pnpm dev` |
| `fullstack/` | `kitr new fullstack --kit fullstack` | `pnpm dev` runs `site` (SSR on :3000) and `api` (:3001); `pnpm build && pnpm start` serves `dist/site` |
| `saas/` | `kitr new saas --kit saas` | `pnpm build`, then `SESSION_SECRET=$(openssl rand -base64 32) MAIL_TRANSPORT=discard pnpm start` (production needs a cookie secret and a mail transport); sign in as `admin@example.com` or `member@example.com` with the password `password`, then create a project |
| `site/` | `kitr new site --kit site` | `pnpm build` prerenders `/`, `/pricing`, `/blog` and every post into `dist/site/client`; `pnpm start` serves them plus the newsletter API |
| `realtime/` | `kitr new realtime --kit realtime` | `pnpm build && pnpm start`, open two tabs and chat: messages arrive over `/api/ws` |
| `desktop/` | `kitr new desktop --kit desktop` | `kitr dev site` in a browser, `kitr dev app` for the Electron window with native dialogs (`platforms/app/`) |
| `mobile/` | `kitr new mobile --kit mobile` | `kitr build site && kitr start site` for the installable PWA; `kitr dev phone --target ios` for the Capacitor shell (`platforms/phone/`) |
| `everywhere/` | `kitr new everywhere --kit dashboard`, then `kitr add desktop app`, `kitr add mobile phone`, `kitr add secure-storage`, `kitr add notifications`, `kitr make:provider flags` | One project, three platforms: `kitr dev` runs `site` (web), `app` (Electron) and `phone` (Capacitor); built in CI by the `everywhere` job. Defined in `scripts/sync-examples.mjs`, with the home page in `scripts/overlays/everywhere/` |

The last five are presets: the same base as `dashboard`/`fullstack` plus real pages, controllers and tests that show the packages working together. They are the fastest way to see what a package does, and `kitr new --kit <preset>` gives you the same files to start from.

Regenerate one from the repo root:

```sh
node packages/kitr/bin/kitr.mjs new examples/<name> --kit <kit> --no-install --no-git --registry $PWD/registry/dist
```

Then point `kitr` and every `@kitr/*` dependency in the new `package.json` at `workspace:*`, rename the package to `@kitr/example-<name>`, delete its `biome.json` and run `pnpm install`.
