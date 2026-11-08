---
title: Built for agents
description: Why kitr suits coding agents, how to install the Claude Code plugin, and what an agent gets from the CLI.
---

# Built for agents

> [!SUMMARY]
> kitr writes its choices down: `kitrrc.ts` lists the wiring, `AGENTS.md` lists the conventions, and every command runs from flags. An agent reads those files instead of guessing.

kitr makes the choices up front and writes them down. Every kind of file has one home, every package has one way in, and every command runs from flags. You spend your time on the code, not on deciding where it goes or which library to use. The same clarity is what makes a coding agent reliable: it has one right answer to find, and the project tells it what that answer is.

## Why it works

An agent goes wrong when a project leaves room for guesses. kitr leaves little. The wiring is listed in `kitrrc.ts`, each package's options are in `config/<package>.ts`, and the folder for each kind of file is fixed and listed by `kitr make`. Because every provider is listed in one file, an agent reads the whole setup in two places.

## Install the Claude Code plugin

The plugin adds three skills: `kitr`, which Claude Code loads on its own in any kitr project, `/kitr:kitr-feature <name>` to scaffold a feature end to end, and `/kitr:kitr-doctor` to fix what `kitr doctor` finds.

```sh
claude plugin marketplace add kitrjs/kitr && claude plugin install kitr@kitr
```

Cursor, Codex, Copilot and other agents that read the open `SKILL.md` format can install the same skills:

```sh
npx skills add kitrjs/kitr
```

## The VS Code extension

A kitr extension for VS Code shows the project's platforms, packages, routes and generators in a sidebar, and runs `kitr make`, `kitr add` and `kitr doctor` from the command palette. [Install it in VS Code](vscode:extension/kitrjs.kitr); projects made by `kitr new` recommend it when you open them.

## What the agent gets

**An `AGENTS.md` that stays current.** `kitr new` writes it with the conventions and the project structure. Every `kitr add` appends that package's rules, such as "import from `@kitr/query`, never from `@tanstack/react-query`" or "mutations declare effects; never invalidate inline", and `kitr remove` takes them out again. Claude Code, Cursor, Copilot and Codex read `AGENTS.md` without setup.

**A generator for every kind of file.** `kitr make --json` lists each generator with the path it writes, and `kitr make:<kind> <name>` writes the file and registers it. The agent never has to decide where a controller or a hook goes. See [Project structure](/docs/project-structure).

**No prompts, and JSON where it helps.** No command waits for input. Every question `kitr add` asks has a flag (`kitr add jobs --no-worker`, or `--yes` for the defaults), and `--dry-run` previews a change. `kitr info`, `kitr make --json`, `kitr doctor --json`, `kitr workspace --json` and `kitr routes:list` give the agent the project in a form it can read.

**A check it can run.** `kitr doctor --json` reports findings with a suggested fix and exits with code 1 on errors. It catches packages missing from `package.json`, providers that do not resolve, direct upstream imports and version drift. `kitr types --check` fails when generated types are stale.

**Docs for models.** This site publishes [llms.txt](/llms.txt), an index of every page, and [llms-full.txt](/llms-full.txt), every page in one file. Every page is also available as markdown by adding `.md` to its URL.

## An example

Ask the agent: "add a projects feature with a list page and a create form". In a `fullstack` project it runs:

```sh
kitr make:validator project                # app/validators/project.ts
kitr make:controller projects --resource   # server/controllers/projects-controller.ts, plus the route line
kitr make:queries projects                 # app/queries/projects.ts
kitr make:page projects                    # app/pages/projects.tsx and its line in app/routes.ts
kitr make:form project                     # app/components/forms/project-form.tsx
kitr doctor --json
```

It fills in the files, adds the route line to `server/routes.ts`, and runs the project's `typecheck` and `test` scripts. Every file lands where the next person, or the next agent, expects it. The [CLI reference](/docs/cli) lists every command and flag.
