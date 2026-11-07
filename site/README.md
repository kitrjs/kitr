# kitr.dev

The kitr site, built with kitr (TanStack Start, prerendered to static HTML).

```sh
pnpm site            # from the repo root: dev server
pnpm -C site build   # static output in site/dist/client
```

## Where content comes from

Nothing about packages is written here. `scripts/content.mjs` runs before dev and build and reads:

| Source | Becomes |
| --- | --- |
| `packages/*/package.json` → `kitr` block | the Packages grid, badges, sidebar |
| `packages/*/docs/*.md` | `/packages/<name>` and `/packages/<name>/<page>` |
| `packages/*/examples/*.tsx` | live examples at `/play/<pkg>/<example>`, framed on the package page |
| `content/docs/nav.json` + `content/docs/*.md` (and repo `docs/*.md` it points at) | `/docs/<slug>` |

It also writes the search index, `llms.txt`, `llms-full.txt` and a `.md` copy of every page.

Code blocks are highlighted at build time. Shell blocks that only contain `kitr` commands render as the package-manager picker, whose choice is stored as `kitr:pm`.

## Adding a package page

Add a `kitr` block and a `docs/index.md` to the package (see `/docs/building-packages`), run `pnpm docs:check`, and the site picks it up.
