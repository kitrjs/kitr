# Examples

Each example is the unmodified output of a CLI kit, with `kitr`/`@kitr/*` pointed at the workspace and the per-project `biome.json` removed so the root config applies.

| Directory | Command | Try |
| --- | --- | --- |
| `backend/` | `kitr new backend --kit server` | `pnpm dev`, then `curl localhost:3000/api/health` |
| `dashboard/` | `kitr new dashboard --kit app` | `pnpm dev` |
| `fullstack/` | `kitr new fullstack --kit fullstack` | `pnpm build && pnpm start` (SSR on `/`, API on `/api/health`) |

Regenerate one from the repo root:

```sh
node packages/kitr/bin/kitr.mjs new examples/<name> --kit <kit> --no-install --no-git --registry ../registry/dist
```
