# kitr plugin for Claude Code

Skills that teach a coding agent how a kitr app is laid out, which command writes each kind of file, and how to check its work.

## Install

```sh
claude plugin marketplace add kitrjs/kitr && claude plugin install kitr@kitr
```

Cursor, Codex, Copilot and other agents that read the open `SKILL.md` format:

```sh
npx skills add kitrjs/kitr
```

## Skills

| Skill | How it runs | What it does |
| --- | --- | --- |
| `kitr` | On its own, in any project with a `kitrrc.ts` or `@kitr/*` imports | Read `AGENTS.md` and `kitrrc.ts` first, create files with `kitr make`, add packages with `kitr add`, import from `@kitr/*`, and finish with `kitr types` and `kitr doctor`. |
| `kitr-feature` | `/kitr:kitr-feature <name>` | Scaffold a feature end to end: validator, data, pages, form and test, then run the checks. |
| `kitr-doctor` | `/kitr:kitr-doctor` | Run `kitr doctor --json` and `kitr types --check`, fix each finding, and rerun until clean. |

The skills add to the project's `AGENTS.md`, which `kitr new` writes and `kitr add` keeps current. They do not replace it.

## Develop

Try the plugin from a checkout without installing it:

```sh
claude --plugin-dir ./tooling/claude
claude plugin validate ./tooling/claude
```

Docs: https://kitr.dev/docs/agents
