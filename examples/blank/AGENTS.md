# Agent guide

This app is built with kitr. Each section below is maintained by `kitr add`.

## kitr: conventions

- Import framework code from `kitr/*` entry points (`@kitr/router`, `@kitr/query`, ...). They re-export the upstream library unchanged plus kitr helpers.
- Where the app runs is a platform in `kitrrc.ts` (`platforms: { site: web({...}), api: server({...}) }`). `kitr dev <name>` / `kitr build <name>` / `kitr start <name>` run one or all; `kitr config <name> <option> <value>` edits options; native projects live in `platforms/<name>/`.
- Wiring lives in `kitrrc.ts` and `config/*.ts`; server code in `server/`. Every package brings its own generators (`kitr make:<kind>`, see `kitr --help`). Generated files are written by `kitr generate` (types under `.kitr/`, the API route table), which `kitr dev`, `kitr build` and `kitr typecheck` run first; import the types from `#kitr/*`. Run `kitr doctor` after changes.
