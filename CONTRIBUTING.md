# Contributing to kitr

Thanks for helping. kitr is a pnpm monorepo: the framework packages live in `packages/`, the CLI kits' output lives in `examples/`, the component registry in `registry/` and kitr.dev in `site/`.

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

## Pull requests

Keep a pull request to one change. Say what it changes and why, and how you checked it. Commit messages are short sentences in the imperative ("Add a Redis cache driver").

## Reporting security issues

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).

## Code of conduct

Everyone taking part in this project follows the [code of conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
