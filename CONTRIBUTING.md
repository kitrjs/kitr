# Contributing to kitr

Thanks for helping. kitr is a pnpm monorepo: the framework packages live in `packages/`, the CLI kits' output lives in `examples/`, the component registry in `registry/`, and the docs kitr.dev publishes in `docs/` (guides in `docs/guides/`, the /docs pages in `docs/handbook/`) and each package's `docs/` folder.

Bug reports and small fixes are always welcome. For a new package, a new entry point or a change to a public API, open an issue first so the design can be agreed before you write the code.

## Setup

You need Node.js 22 or newer and pnpm (the version is pinned in `packageManager`; `corepack enable` picks it up).

```sh
git clone https://github.com/kitrjs/kitr.git
cd kitr
pnpm install
pnpm build        # every package, in dependency order
```

## Checks

Run what touches your change before you open a pull request. CI runs all of them.

```sh
pnpm lint             # biome; pnpm lint:fix writes the fixes
pnpm typecheck        # packages, registry and examples
pnpm test             # unit tests (vitest)
pnpm test:integration # CLI and kit tests against the built packages and registry
pnpm test:e2e         # playwright against the examples
```

Generated files have their own checks. If one fails, run the command without `--check` and commit the result:

| Check | Regenerate with | What it covers |
| --- | --- | --- |
| `pnpm manifests:check` | `pnpm manifests` | package manifests |
| `pnpm readmes:check` | `pnpm readmes` | each package's README |
| `pnpm docs:api --check` | `pnpm docs:api` | the generated `api.md` reference pages |
| `pnpm check:examples` | see [examples/README.md](examples/README.md) | `examples/` is unmodified kit output |

## Making a change

- **Re-export, never re-implement.** An `@kitr/*` package re-exports the library it wraps and adds beside it. Read [docs/entry-points.md](docs/entry-points.md) and [docs/package-contract.md](docs/package-contract.md) before adding exports or a package.
- **Docs ship with the code.** A package's guide lives in `packages/<name>/docs/` and follows [docs/STYLE.md](docs/STYLE.md); `pnpm docs:rules` and `pnpm docs:check` check the mechanical rules.
- **Tests ship with the code.** A fix comes with a test that fails without it.
- **Changesets.** If a published package changes, run `pnpm changeset` and describe the change for users. All packages release together on one version.
- **Examples are generated.** Change the kit in the CLI, then regenerate the example; do not edit `examples/` by hand.

## How CI works

`.github/workflows/ci.yml` builds once, uploads the result, and runs these jobs in parallel against it:

| Job | What it checks |
| --- | --- |
| `verify` | Generated files, docs rules, Biome, examples, bundle sizes and `pnpm versions:check`. |
| `typecheck` | `pnpm typecheck` across every package and example. |
| `unit` | `pnpm test:coverage` on Node 22 and 24 with a real Redis, then the coverage gate. |
| `integration` | `pnpm test:integration`: the CLI, the kits, the backend over the network. |
| `e2e` | Playwright against every kit, in production and dev builds. |
| `registry-smoke` | `pnpm smoke:registry`: install from a real registry. |
| `windows` | The CLI integration suite on Windows. |

### Registry smoke test

`scripts/verdaccio-smoke.mjs` publishes every package to a throwaway [Verdaccio](https://verdaccio.org), checks that every dependency and peer installs, then runs `kitr new` for the `app` and `fullstack` kits through the installed `node_modules/.bin/kitr`, as a global install does. In each new project, `kitr doctor` must report no error or warning, `kitr make:page 'docs/$slug'` must write the page and its route, `kitr ui add button` must copy the component (kits with the theme), and the project must typecheck and build. Run it after `pnpm build` and `pnpm -C registry build` with `pnpm smoke:registry`. Options: `--kits app,saas`, `--pm npm`, `--matrix` (`app`, `site`, `fullstack` and `dashboard`, each with npm and pnpm, on one registry), `--all-packages`, `--skip-projects`, `--keep`, `--port`.

CI runs a few kits on every pull request (`registry-smoke` in `ci.yml`); `.github/workflows/smoke-nightly.yml` runs `--matrix --all-packages` every night on `main`.

### Upstream versions

`packages/cli/src/versions.ts` is the set of library versions `kitr new` writes and `kitr upgrade` moves to. `pnpm versions:check` fails when a `package.json` or the lockfile disagrees with it. Renovate groups those libraries into a few weekly pull requests; on one that changes `versions.ts`, run `pnpm sync:examples` and commit the result.

### Nightly canary

`.github/workflows/canary.yml` runs every night with `pnpm update --latest`, builds and runs the unit tests. A failure opens or updates one issue labelled `canary`; a green run closes it.

### Publishing

`release.yml` runs Changesets on `main`. It opens a "Version packages" pull request and publishes to npm when that is merged. It needs an `NPM_TOKEN` secret.

### Browser tests

`tests/e2e/` has one Playwright project per kit, each against a real build on its own port (see `playwright.config.ts`). `tests/e2e/prepare.mjs` builds each app from a copy of `examples/<kit>`, adds the files in `tests/e2e/fixtures/<kit>/`, and applies a `variant-<name>.mjs` for `--variant <name>`. `KITR_E2E_BUILDS` sets how many build at once (default 3).

### Hand-edited projects

`tests/integration/dirty-project.test.ts` edits the fullstack example the way people do (reordered providers, renamed imports, comments, tabs, semicolons), then adds and removes packages and platforms. Every hand edit must survive byte for byte, and removing what was added must restore the file exactly. That is why the codemods edit `kitrrc.ts` as text (`packages/cli/src/rc-text.ts`).

### Coverage gate

`pnpm coverage:gate` reads `coverage/coverage-summary.json` and exits 1 when a package is under its floor. Floors live in `coverage.floors.json`: 80 by default, lower for listed packages with a reason (native shells sit at 60 because Node cannot run their code). Raise a floor when coverage improves, and give a reason if you ever lower one.

## Pull requests

Keep a pull request to one change. Say what it changes and why, and how you checked it. Commit messages are short sentences in the imperative ("Add a Redis cache driver").

## Reporting security issues

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).

## Code of conduct

Everyone taking part in this project follows the [code of conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
