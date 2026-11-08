# Writing package docs

The rulebook for every `packages/<name>/docs/` folder. The site builds those folders into kitr.dev, `llms.txt` and the search index, so the shape of each guide is the shape of the product. `node scripts/docs-rules.mjs` checks the mechanical rules; reviewers check the rest.

A guide covers every task a reader will have, shown in code, in one place. Every package's guide follows the same order, so a reader learns it once and then jumps by the table of contents. Each thing is said once, in a paragraph of one or two sentences, and a guide is as long as its tasks need and no longer.

## The shape of a package's docs

```
packages/<name>/docs/
├── overview.md  # the landing page at /packages/<name>: what it is, built on, problems it solves, further reading
├── index.md     # the guide at /packages/<name>/guide: everything a reader needs, in the order below
└── api.md       # the reference at /packages/<name>/api: every export with its signature; generated
```

Link to a guide section as `/packages/<name>/guide#<section>`. Until a package has an `overview.md`, the site builds its overview from the manifest.

More pages are allowed when the guide passes 6,000 words. Split by audience, not by topic: `server.md` for the server half of a package that runs on both sides, `tauri.md` and `electron.md` for a platform with two shells. Each extra page keeps the same frontmatter and links back to the guide in its first paragraph.

### index.md, section by section

The headings in bold are required with that exact name, in that order, as H2s. The checker fails a guide without them. Other H2s go between them in the places shown.

**Frontmatter.** `title`, `description` (identical to the manifest `summary`) and `order: 1`.

**Lead (no heading).** Two to four sentences. The first names a situation the reader recognises ("Sign-up confirmations, password resets, invoices: almost every app sends email"). The second says what the package does about it, in words a beginner understands. The third says what it is built on, with a link, and what it adds on top. Then one line on where it runs (client, server, both) and one line saying when *not* to use it, with the package to use instead.

**When to use it** (optional H2). Only when the choice is real: query against state, actions against api, http against actions. Two short paragraphs: use it for X, use the other for Y.

**Install** (required). The `kitr add <name>` command, then a bulleted list headed "What `kitr add` does" with one line per change: packages installed, the provider added to `kitrrc.ts`, the config file written, env variables added to `.env.example`, scripts added to `package.json`, files generated, `AGENTS.md` lines. If the package asks a question during `kitr add`, show the question, its default and its flag form (`--no-worker`) in a table, because agents and CI run with flags only. If a kit already includes the package, say which.

**Configure** (required). The complete `config/<name>.ts` that `kitr add` writes, as a code block whose first line is the path comment. Then a table with the columns `Option | Default | Description`, one row per option, nested options as `transport.apiKey`. Then a table of env variables, if any: `Variable | Used for`. Environment overrides and `kitr config` commands belong here too. A package with no config file says so in the Configure section's first sentence ("`@kitr/forms` has no config file.") and documents the options of the call that sets it up instead: the code that wires it, then the same `Option | Default | Description` table.

**First example** (required, heading is yours). "Send your first email", "Your first store", "Protect a page". The shortest complete, pasteable path to a visible result: usually one file of 10 to 25 lines, then the line that uses it, then what the reader sees. This is the section most readers stop at, so it must work verbatim in a fresh `kitr new` project.

**Tasks** (one H2 each, as many as the package has). Verb-first headings a reader would search for: "Attach a file", "Send from a job", "Queue it", "Read a flag on the server", "Switch transports at run time". Each: one to three sentences on when, the code, one to three sentences on what happened, including the error you get when it goes wrong. Group drivers, adapters, transports and providers under one H2 ("Transports") with one H3 per driver, each following the same template: install line, config snippet, env line, link to the vendor's docs. Put production notes where they bite ("Rate limits in production"), not at the end.

**Commands** (required when the package adds CLI commands or generators). A table `Command | What it does`, then one example of each generator with the file it writes. Every `kitr make:<x>` and `kitr <name>:<verb>` the package registers is listed here and nowhere else.

**Errors** (optional H2, strongly encouraged). A table of the errors the package throws: `Code | When | What to do`. Packages whose errors reach the browser (http, actions, api, forms, uploads) must have it.

**Testing** (required). How to use the package in a test without the real thing: the fake, the in-memory driver, `.sent`, `createTestApp`. At least one complete Vitest test. Show the assertions a reader will actually write. A package with nothing to fake still shows how to render or run it inside `createTestApp`.

**Extend** (required when the package has a driver, adapter, transport, provider, reporter or formatter interface). The interface, a minimal implementation of 15 to 40 lines, and how it is registered in config. Link the matching type in api.md.

**Devtools** (optional). What the package's panel shows and what it logs, with a screenshot-free description. Only when the package registers a panel.

**Next steps** (required). Three to six links: the API page, the upstream library's docs, related packages (`/packages/<name>`), the guide on the site that uses it. Nothing else.

### api.md

Generated by `pnpm docs:api` from the built `.d.ts` files. Do not edit it; fix the source. The rule it enforces is on the source: **every exported function, class, constant, interface and type has a doc comment** of one to three sentences that says what it is for, not what its name says. `cached()` is not documented by "Caches a function". Interfaces document each member. Packages with a hand-written api.md (no `GENERATED` marker) follow the same shape by hand.

## Writing rules

These apply to every sentence and every code block.

1. **One scenario per package.** Pick it in the lead and keep it to the end. The cast is shared across kitr: the company is Acme, people are Ada, Grace and Linus, the domain is `acme.com` and the app lives at `app.acme.com`, data is orders, invoices, projects and teams. Never `foo`, `bar`, `baz`, `MyComponent`, `doSomething`, `test@test.com`. The checker rejects placeholder names.
2. **Every code block is complete and pasteable.** Imports included, from the `@kitr/<name>` package (`kitr/app` and `kitr/env` for the config). If it is a file, the first line is a comment with its path from the project root (`// server/mail/welcome.tsx`). Elided code is `// ...`, never `...` on its own.
3. **Show the result.** After a call, show what comes back: a `// => { id: 'msg_1' }` comment, the log line, the HTTP response, the thrown error with its code. A reader should never have to run it to find out.
4. **Say what happens, then why.** A section opens with what the reader wants ("To send without making the request wait, dispatch a job"), shows the code, then explains the mechanism in one or two sentences. Mechanism before motive loses beginners.
5. **Headings are tasks or nouns a reader would search for.** "Send from a job", "Transports", "Rate limits in production". Not "Advanced", "Misc", "Other features", "Usage". The headings are the table of contents, the search index and the `llms.txt` outline, so each must make sense out of context.
6. **Tables for anything with more than three rows.** Options, env variables, errors, commands, drivers, flags, events, hooks. Columns are `Thing | Default | Description` or `Thing | Description`. Code in tables is in backticks. A description cell is one short sentence plus at most one example. Anything longer goes in a section under the table. The checker fails a cell over 30 words.
7. **Name the wrong way next to the right way** when there is a common mistake: "Don't call `queryClient.invalidateQueries` in the component; declare the effect on the mutation."
8. **Warnings are for risk only.** A `> **Warning**` blockquote marks data loss, security and production refusal ("production refuses to boot without a transport"). Tips and notes are plain sentences in the flow.
9. **Where it runs is always stated.** Every section that only works on one side says so in its first sentence: "On the server, ...", "In a component, ...". Packages that run on both sides have their server half under its own H2s, tagged in the heading when it helps ("Cookies on the server").
10. **Link out where kitr stops.** The first mention of the upstream library links to its docs. Anything kitr re-exports without changing is a link, not a copy. Another kitr package is `/packages/<name>`; a site doc is `/docs/<slug>` and a guide is `/guides/<slug>`.
11. **Short sentences, plain words, present tense, second person.** "You call `send()`" not "The developer may invoke the `send` method". No "simply", "just", "easy", "powerful". No marketing in the guide; that is the package card's job.
12. **Coverage, then brevity.** A guide is done when a reader can do every task the package supports without opening the source, and nothing in it is said twice. The checker asks for 600 prose words and 8 code blocks as a floor; there is no ceiling, but a paragraph over two sentences, a list over four items that is not a table, or detail a reader can skip on first read (everything `kitr add` changed, every edge case) are signs to restructure: a callout, a table or a `<details>` block.
13. **Scannable devices.** A `> [!SUMMARY]` callout right after the lead gives what the package is, the `kitr add` command and a link to the overview. The list of what `kitr add` changed and the `kitr remove` paragraph sit in `<details><summary>Everything kitr add changes</summary>`. A sentence that stops a real mistake is a `> [!WARNING]`. The last section, `## Next steps`, is two or three link items and renders as cards.

## Writing guides

Package docs explain one package. Guides on kitr.dev/guides walk through one goal from an empty folder to a working result, across as many packages as it takes: "Build a full-stack app", "Deploy to production", "Migrate from Next.js". They live in `docs/guides/<slug>.md`, are listed in `docs/guides/nav.json`, and are checked by `pnpm docs:guides`.

**Frontmatter.** `title` (verb first, the goal: "Add sign-in, end to end"), `description` (one sentence on what the reader ends up with), `packages` (the kitr packages the guide uses, comma-separated; each becomes a chip and a link), `platforms` (`web`, `server`, ...; the platform pages list the guides for them) and `time` ("45 min").

**Lead (no heading).** One paragraph on the situation and why it is hard, one on what the reader will build, with the running example named (`acme-projects`, `acme-billing`).

**Before you start** (required, first H2). What to install, which guide or kit to start from, and any outside service (Postgres, a Slack webhook) with a one-line way to get it.

**Steps** (one H2 each). Each is a task in the order the reader does it: "Store users and sessions", "Protect the pages", "Run migrations before the new version starts". Each step leaves the app working, and says what the reader sees when it does: the output, the page, the HTTP response.

**Next steps** (required, last H2). Three to six links: the packages used, the guides that follow on, upstream docs.

Rules on top of the writing rules above:

1. **Continue an earlier guide's app rather than starting a new one**, when one fits. The testing, deploy and sign-in guides all build on `acme-projects` from the full-stack guide, so a reader can follow them in a row.
2. **Link packages, don't re-document them.** A guide shows the code the goal needs and links `/packages/<name>` for every option. When a guide needs more than a package's docs explain, fix the package docs first.
3. **Only document what ships.** A guide uses packages, commands and options that exist on `main`. Never document an API that is not on `main`.
4. **Say where it stops.** When kitr has no answer (incremental static regeneration, `next/image`), say so in a table with what to do instead.
5. **Floors:** 600 prose words and 6 code blocks. Length follows the task; say each thing once.

## Checklist before a docs PR

- [ ] Frontmatter present; `description` equals the manifest `summary`.
- [ ] Required H2s in order: Install, Configure, (first example), tasks, (Commands), Testing, (Extend), Next steps.
- [ ] Install lists every change `kitr add` makes and every question as a flag.
- [ ] Configure shows the full `config/<name>.ts` and the options table, every option with a default.
- [ ] One scenario; no placeholder names.
- [ ] Every code block has its imports, its file path if it is a file, and its result.
- [ ] Every driver, adapter, transport or provider has its own H3 with the same four parts.
- [ ] Every CLI command and generator the package registers is in Commands.
- [ ] Testing has a complete test. Extend has a complete driver when there is an interface.
- [ ] Every export in api.md has a doc comment.
- [ ] `pnpm docs:check && pnpm docs:rules <name> --strict && pnpm docs:api --check` pass.

## How the checks run

| Command | What it checks | In CI |
| --- | --- | --- |
| `pnpm docs:check --strict` | Frontmatter, summary match, links between packages, every package has docs. | fails the build |
| `pnpm docs:rules` | The mechanical rules above, plus short table cells in the guides, `docs/` and the site docs. | fails the build |
| `pnpm docs:api --check` | Generated api.md pages are up to date with the type definitions. | fails the build |
| `pnpm docs:guides --strict` | The guide rules above: frontmatter, listed in `nav.json`, "Before you start" first and "Next steps" last, depth floors, placeholders, and links to packages, docs and guides that exist. | fails the build |

Add a package name to `docs:rules` to check one: `node scripts/docs-rules.mjs mail --strict`. CI runs it with `--strict`, so every guide must pass. `node scripts/docs-rules.mjs --gaps` prints a table of each package's prose words, code blocks and broken rules.

## Docs follow the setup module

Each package's setup lives in the package: `packages/<name>/src/kitr.ts` exports `definePackage({ questions, add, remove, commands, generators, doctor, vite })`. The docs follow it.

- **Install documents `add()`.** The "What `kitr add` does" list is the codemods in `add()`, in the order they run: `ctx.provider.add`, `ctx.config`, `ctx.write`, `ctx.scripts.add`, `ctx.env`, `ctx.agents.add`. When `add()` changes, the list changes in the same PR. The checker reads `src/kitr.ts`: a package with `questions` must show flags in Install, and one with `commands` or `generators` must have a Commands section.
- **Configure documents what `ctx.config()` writes.** The code block in Configure is the same text the codemod writes, comments included, so a reader comparing the two sees no difference.
- **Commands documents `commands` and `generators`.** Every entry in those maps is a row in the Commands table. `doctor` checks are documented as a short list under Commands ("`kitr doctor` warns when ...").
- **Remove is one sentence** at the end of Install: "`kitr remove <name>` reverses every step above", plus anything it leaves behind on purpose.
- **Kits are packages** (`@kitr/kit-<name>`), documented together in `docs/kits.md`: one section per kit with its platforms, packages, components and a walkthrough of the pages, controllers and tests it scaffolds, instead of a guide per kit.
- The platform packages (web, server, desktop, mobile) own their options, scaffold and tooling, so each platform's guide carries its full options table.
