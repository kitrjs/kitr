---
title: Glossary
description: The words kitr uses, each in one line: platform, package, kit, provider, contract, effects and more.
---

# Glossary

This page defines every word kitr uses for its own ideas, in one line each.

| Term | Meaning |
| --- | --- |
| Platform | Where an app runs: web, server, desktop, mobile. Named in `kitrrc.ts` |
| Package | One capability, published as `@kitr/<name>` and added with `kitr add` |
| Kit | A starting set of platforms, packages and files for `kitr new` |
| Preset | A kit with real pages, controllers and tests: `saas`, `site`, `realtime` |
| Provider | A package's startup hooks: register, boot, ready, shutdown, wrap |
| Entry point | An import path such as `@kitr/router` that exposes a package |
| Route table | The list of pages in `app/routes.ts`, one `.page()` per URL |
| Contract | The one shape for queries, mutations and subscriptions, whatever serves them |
| Effects | Cache changes a mutation declares: invalidate, set, remove |
| `kitrrc.ts` | The project file that lists packages, providers and platforms |
| `config/` | One options file per package, typed by the package |
| `AGENTS.md` | Conventions for coding assistants, kept up to date by `kitr add` |

## Next steps

- [What is kitr](/docs/what-is-kitr): the short mental model.
- [Configuration](/docs/configuration): how `kitrrc.ts`, `config/` and providers fit together.
