# Agent guide

This app is built with kitr. Each section below is maintained by `kitr add`.

## kitr: conventions

- Import framework code from the `@kitr/*` package that `kitr add` installed (`@kitr/router`, `@kitr/query`, ...). Each re-exports the upstream library unchanged plus kitr helpers. `kitr` itself is the CLI and the `kitrrc.ts` config (`kitr/app`, `kitr/env`).
- Where the app runs is a platform in `kitrrc.ts` (`platforms: { site: web({...}), api: server({...}) }`). `kitr dev <name>` / `kitr build <name>` / `kitr start <name>` run one or all; `kitr config <name> <option> <value>` edits options; native projects live in `platforms/<name>/`.
- Wiring lives in `kitrrc.ts` and `config/*.ts`; server code in `server/`. Every package brings its own generators (`kitr make:<kind>`, see `kitr --help`). Generated types live in `.kitr/` (`kitr types`, also run by `kitr dev` and `kitr build`); import them from `#kitr/*`. Run `kitr doctor` after changes.
