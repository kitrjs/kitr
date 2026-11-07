---
title: Working with coding agents
description: Why kitr suits AI coding assistants, and how to get the best from them.
---

# Working with coding agents

kitr is designed so that a coding assistant (Claude Code, Cursor, Copilot, Codex) makes the same choices you would.

## Everything runs from flags

No kitr command prompts. `kitr new my-app --kit app --pm pnpm`, `kitr add auth`, `kitr make:form invite` and `kitr doctor` all run start to finish from their arguments, so an agent or a CI job never gets stuck waiting for input.

## AGENTS.md is kept up to date

`kitr new` writes an `AGENTS.md` at the project root, and every `kitr add` appends that package's conventions, such as "import from `kitr/query`, never from `@tanstack/react-query`" or "mutations declare effects; never invalidate inline". `kitr remove` takes them out again. Most agents read `AGENTS.md` automatically.

## Explicit wiring

Because every provider is listed in `kitrrc.ts` and every option lives in `config/`, an agent can see the whole setup in two places instead of guessing what a plugin did.

## Checks it can run

```sh
kitr doctor --json
```

Machine-readable findings with suggested fixes, and exit code 1 on errors. Ask your agent to run it after any change to dependencies or wiring.

## Docs for models

This site publishes [llms.txt](/llms.txt), an index of every page, and [llms-full.txt](/llms-full.txt), every page in one file. Every page is also available as markdown by adding `.md` to its URL.
