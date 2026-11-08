# kitr for VS Code

The [kitr](https://kitr.dev) sidebar. Open a project with a `kitrrc.ts` and the kitr view shows what the project is made of, with the commands you run most one click away.

<!-- Screenshot: the kitr sidebar with Platforms, Packages, Routes and Generators open. Add media/screenshot.png before the first Marketplace release. -->

The extension is a thin view over the project's own `kitr` CLI (`kitr info`, `kitr make --json`, `kitr doctor --json`, `kitr routes:list`). Whatever kitr version the project has installed is the one it asks, so the sidebar never disagrees with the terminal.

## Features

- **Platforms**: every platform in `kitrrc.ts` with its type and key options (`web · mode=ssr · port=3000`). Inline buttons run `kitr dev`, `kitr build` and `kitr start` for that platform in a terminal.
- **Packages**: the installed `@kitr/*` packages; click one to open its `config/<package>.ts`. "Add package…" picks from the known packages and runs `kitr add`.
- **Providers**: the providers listed in `kitrrc.ts`; click to jump to the line.
- **Routes**: pages from `app/routes.ts`, nested by layout and group, each opening its file in `app/pages`; API routes from `kitr routes:list`, each opening its controller.
- **Generators**: every `make:<kind>` the project has, with the path it writes. Click one, type a name, and the new file opens.
- **Doctor**: runs `kitr doctor --json` and puts each finding in the Problems panel, on the file it is about or on `kitrrc.ts`.
- **Status bar**: `kitr <version>`; it turns red when doctor last found errors. Click to run doctor again.
- The trees refresh when `kitrrc.ts`, `config/`, `app/routes.ts`, `server/routes.ts` or `package.json` change.

## Commands

All under `kitr:` in the command palette.

| Command | What it runs |
| --- | --- |
| Make… | `kitr make:<kind> <name>`, then opens the file |
| Add package… | `kitr add <package>` in a terminal |
| Add platform… | `kitr add <type> <name>` in a terminal |
| Dev / Build / Start | `kitr dev [platform]` and friends in a terminal |
| Doctor | `kitr doctor --json` into the Problems panel |
| Types | `kitr types` |
| Open AGENTS.md | The project's agent guide, kept current by `kitr add` |
| Refresh | Reload every tree |
| Select project… | Pick a project when the workspace has several `kitrrc.ts` |

## Install

- From the Marketplace or Open VSX: search for "kitr" (publisher `kitrjs`), or open `vscode:extension/kitrjs.kitr`.
- Projects made with `kitr new` recommend it in `.vscode/extensions.json`, so VS Code offers to install it the first time you open one.
- From a `.vsix`: download it from the "vscode-release" workflow run, then run "Extensions: Install from VSIX…".

## Settings

| Setting | Default | |
| --- | --- | --- |
| `kitr.cliPath` | empty | The kitr binary. Empty: the project's `node_modules/.bin/kitr`, else `pnpm exec kitr`, `npx kitr`, `yarn kitr` or `bunx kitr` by the lockfile. |
| `kitr.doctorOnOpen` | `true` | Run doctor quietly when the workspace opens, to colour the status bar. |

## Develop

```sh
cd tooling/vscode
npm ci
npm run build       # dist/extension.js (esbuild)
npm run typecheck
npm test            # vitest: parsers and the tree model, against real CLI output in test/fixtures
npm run package     # kitr-<version>.vsix
```

Press F5 with this folder open in VS Code to start an Extension Development Host. This folder is not part of the pnpm workspace: the extension's package name has to be `kitr`, which the CLI package already uses there.

See [PUBLISHING.md](PUBLISHING.md) for releases.
