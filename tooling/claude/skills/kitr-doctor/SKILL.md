---
name: kitr-doctor
description: Run kitr doctor and kitr types --check on a kitr project, fix every finding, and rerun until both are clean.
disable-model-invocation: true
---

# Fix kitr doctor findings

## 1. Run the checks

```sh
kitr doctor --json
kitr types --check
```

`kitr doctor --json` prints a list of findings. Each has `level` (`error`, `warn` or `info`), `message` and, often, `fix`. It exits with code 1 when there is an error. `kitr types --check` lists stale files in `.kitr/` and exits non-zero instead of writing.

## 2. Fix each finding

Work through errors first, then warnings. Leave `info` findings alone unless the fix is one line.

- When a finding has a `fix`, apply it. It is usually a command (`kitr add <pkg>`, `pnpm add <pkg>`, `kitr upgrade`) or an import to change.
- A package in `kitrrc.ts` but not in `package.json`: install it with the project's package manager.
- A direct upstream import (`@tanstack/react-query` where `@kitr/query` is installed): change the import to the `@kitr/*` package. The exports are the same.
- A provider that does not resolve: fix the path in `kitrrc.ts`, or run `kitr add <pkg>` again for a package's own provider. Do not delete the line to silence it.
- A missing config file: run `kitr add <pkg>` again rather than writing `config/<pkg>.ts` by hand.
- Stale types: run `kitr types`. Never edit `.kitr/` by hand.
- Version drift: run `kitr upgrade`. It lists major bumps instead of applying them; leave majors to the user.

Do not remove packages, providers or platforms to make a finding go away unless the user asked for that.

## 3. Rerun

Run both checks again. Repeat until `kitr doctor --json` has no errors and `kitr types --check` passes. Then run the project's `typecheck` script.

## 4. Report

For each finding: what it was, what you changed, and whether it is gone. List anything you left for the user, such as major upgrades, and why.
