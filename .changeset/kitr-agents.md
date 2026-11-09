---
"@kitr/cli": patch
---

`kitr agents` prints the project's `AGENTS.md`, so an agent can read the rules without opening the file. `--list` prints the `## kitr: <name>` section names and `--section <name>` prints one section. Outside a project it fails and names the file it looked for.
