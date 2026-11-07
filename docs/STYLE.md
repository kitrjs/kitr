# Writing package docs

The rulebook for every `packages/<name>/docs/` folder. The site builds those folders into kitr.dev, `llms.txt` and the search index, so the shape of each guide is the shape of the product. `node scripts/docs-rules.mjs` checks the mechanical rules; reviewers check the rest.

The bar is the [AdonisJS mail guide](https://docs.adonisjs.com/guides/digging-deeper/mail). It is about 5,000 words and 70 code blocks for one package. Ours average 350 words and 5 code blocks. The gap is not prose quality, which is already good. The gap is coverage: every task a reader will have, shown in code, in one place, in a predictable order.

## What the research found

Four documentation sets were studied: AdonisJS (mail, i18n), Laravel (mail), Stripe (accept a payment) and Tailwind (responsive design). They agree on more than they differ.

**One page per package, long, in a fixed order.** AdonisJS and Laravel put everything about mail on one page, 5,000 to 6,000 words, under 15 to 25 H2s. The order is the same on every page: what it is, install, configure, first use, then one H2 per task, then testing, then extending. Readers learn the order once and then jump by the table of contents.

**Install says what it changed.** AdonisJS follows every `node ace add` with "See steps performed by the add command": installs the package, registers the provider, creates `config/mail.ts`, defines these env variables. Nothing happens to the project that the reader was not told about.

**Configuration is a full file plus a table.** Every guide shows the complete `config/<name>.ts` as it is written to disk, then a table of every option with its default and one sentence. Per-driver setup follows an identical template each time: install, config snippet, `.env` snippet, link to the provider's own docs.

**Every section is a task, and every task is code.** Headings are things a reader wants to do: "Queueing emails", "Embedding images", "Targeting a breakpoint range". Each starts with one to three sentences, then a 5 to 20 line example, then what happened. Tailwind follows each example with bullets that map one line of code to one effect, and names the wrong way next to the right way ("Don't use `sm:` to target mobile devices").

**Examples are one running scenario.** Laravel uses `OrderShipped` and an `Order` model from the first section to the last. AdonisJS uses a `UsersController`, invoices under `storage/invoices/` and `orders@example.com`. A reader builds one mental model instead of a new one per section. No `foo`, `bar` or `MyThing`.

**Testing and extending are top-level sections.** Mail fakes, assertion tables, custom transports and custom template engines each get an H2, so a reader finds them without reading the whole page.

**Warnings only for risk.** Callouts mark data loss and security ("the in-memory messenger loses queued emails on restart"), not tips. Everything else is plain prose.

**Reference content goes in tables.** Breakpoints, test card numbers, ICU patterns and options all sit in two or three column tables so they can be scanned. Stripe tags every heading with where the code runs ("[Server-side]", "[Client-side]") and gives concrete test values for every outcome.

**The page ends by pointing somewhere.** Stripe ends with "See also", Laravel links upstream (Symfony Mailer) wherever it stops, AdonisJS links the config stub, the command reference and the events reference.

## The shape of a package's docs

```
packages/<name>/docs/
├── index.md   # the guide: everything a reader needs, in the order below
└── api.md     # the reference: every export with its signature and one sentence; generated
```

More pages are allowed when the guide passes 6,000 words. Split by audience, not by topic: `server.md` for the server half of a package that runs on both sides, `tauri.md` and `electron.md` for a platform with two shells. Each extra page keeps the same frontmatter and links back to the guide in its first paragraph.

### index.md, section by section

The headings in bold are required with that exact name, in that order, as H2s. The checker fails a guide without them. Other H2s go between them in the places shown.

**Frontmatter.** `title`, `description` (identical to the manifest `summary`) and `order: 1`.

**Lead (no heading).** Two to four sentences. The first names a situation the reader recognises ("Sign-up confirmations, password resets, invoices: almost every app sends email"). The second says what the package does about it, in words a beginner understands. The third says what it is built on, with a link, and what it adds on top. Then one line on where it runs (client, server, both) and one line saying when *not* to use it, with the package to use instead.

**When to use it** (optional H2). Only when the choice is real: query against state, actions against api, http against actions. Two short paragraphs: use it for X, use the other for Y.

**Install** (required). The `kitr add <name>` command, then a bulleted list headed "What `kitr add` does" with one line per change: packages installed, the provider added to `kitrrc.ts`, the config file written, env variables added to `.env.example`, scripts added to `package.json`, files generated, `AGENTS.md` lines. If the package asks a question during `kitr add`, show the question, its default and its flag form (`--no-worker`) in a table, because agents and CI run with flags only. If a kit already includes the package, say which.

**Configure** (required). The complete `config/<name>.ts` that `kitr add` writes, as a code block whose first line is the path comment. Then a table with the columns `Option | Default | Description`, one row per option, nested options as `transport.apiKey`. Then a table of env variables, if any: `Variable | Used for`. Environment overrides and `kitr config` commands belong here too. A package with no config file says so in the Configure section's first sentence ("`kitr/forms` has no config file.") and documents the options of the call that sets it up instead: the code that wires it, then the same `Option | Default | Description` table.

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
2. **Every code block is complete and pasteable.** Imports included, from the `kitr/<name>` entry point, never from `@kitr/<name>`. If it is a file, the first line is a comment with its path from the project root (`// server/mail/welcome.tsx`). Elided code is `// ...`, never `...` on its own.
3. **Show the result.** After a call, show what comes back: a `// => { id: 'msg_1' }` comment, the log line, the HTTP response, the thrown error with its code. A reader should never have to run it to find out.
4. **Say what happens, then why.** A section opens with what the reader wants ("To send without making the request wait, dispatch a job"), shows the code, then explains the mechanism in one or two sentences. Mechanism before motive loses beginners.
5. **Headings are tasks or nouns a reader would search for.** "Send from a job", "Transports", "Rate limits in production". Not "Advanced", "Misc", "Other features", "Usage". The headings are the table of contents, the search index and the `llms.txt` outline, so each must make sense out of context.
6. **Tables for anything with more than three rows.** Options, env variables, errors, commands, drivers, flags, events, hooks. Columns are `Thing | Default | Description` or `Thing | Description`. Code in tables is in backticks.
7. **Name the wrong way next to the right way** when there is a common mistake: "Don't call `queryClient.invalidateQueries` in the component; declare the effect on the mutation."
8. **Warnings are for risk only.** A `> **Warning**` blockquote marks data loss, security and production refusal ("production refuses to boot without a transport"). Tips and notes are plain sentences in the flow.
9. **Where it runs is always stated.** Every section that only works on one side says so in its first sentence: "On the server, ...", "In a component, ...". Packages that run on both sides have their server half under its own H2s, tagged in the heading when it helps ("Cookies on the server").
10. **Link out where kitr stops.** The first mention of the upstream library links to its docs. Anything kitr re-exports without changing is a link, not a copy. Another kitr package is `/packages/<name>`; a site guide is `/docs/<slug>`.
11. **Short sentences, plain words, present tense, second person.** "You call `send()`" not "The developer may invoke the `send` method". No "simply", "just", "easy", "powerful". No marketing in the guide; that is the package card's job.
12. **Depth over polish.** A guide is done when a reader can do every task the package supports without opening the source. The checker asks for 1,200 prose words and 15 code blocks as a floor. Most packages land at 2,000 to 4,000 words and 25 to 40 blocks when every task is covered. Platform and transport-heavy packages (realtime, storage, desktop, auth) land higher.

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
| `pnpm docs:rules` | This file's mechanical rules: required sections and order, config block and table, depth floors, placeholders, a test in Testing, Commands when the package ships commands, doc comments in api.md. | warns today; `--strict` once every package passes |
| `pnpm docs:api --check` | Generated api.md pages are up to date with the type definitions. | fails the build |

Add a package name to `docs:rules` to check one: `node scripts/docs-rules.mjs mail --strict`. The rollout flips CI to `--strict` as the last step, after every package passes.

## The minimal-core rework

The "Make kitr core minimal and fully opt-in" work moves each package's setup out of the CLI and into the package itself: `packages/<name>/src/kitr.ts` exports `definePackage({ questions, add, remove, commands, generators, doctor, vite })`. Docs rules follow that move.

- **Install documents `add()`.** The "What `kitr add` does" list is the codemods in `add()`, in the order they run: `ctx.provider.add`, `ctx.config`, `ctx.write`, `ctx.scripts.add`, `ctx.env`, `ctx.agents.add`. When `add()` changes, the list changes in the same PR. The checker reads `src/kitr.ts`: a package with `questions` must show flags in Install, and one with `commands` or `generators` must have a Commands section.
- **Configure documents what `ctx.config()` writes.** The code block in Configure is the same text the codemod writes, comments included, so a reader comparing the two sees no difference.
- **Commands documents `commands` and `generators`.** Every entry in those maps is a row in the Commands table. `doctor` checks are documented as a short list under Commands ("`kitr doctor` warns when ...").
- **Remove is one sentence** at the end of Install: "`kitr remove <name>` reverses every step above", plus anything it leaves behind on purpose.
- **Kits become packages**, so a kit's docs follow this file too, with the Tasks replaced by a walkthrough of the pages, controllers and tests the kit scaffolds.
- The platform packages (web, server, desktop, mobile) own their options, scaffold and tooling, so their guides carry the full options table today held in `docs/platforms.md`. That page becomes an index linking to the four guides.

Until the rework lands for a package, document what the CLI recipe does today, in the same list form, so the content is right when the code moves.

## Gap list

Generated by `node scripts/docs-rules.mjs --gaps` on the day this file was written. Word counts are prose only, code excluded. Every package below the 1,200 word floor needs a rewrite to the section order above, not an edit. The order of work for the rollout: packages every kit includes first (react, router, query, http, forms, state, tailwind, theme, server, api, actions, auth), then backend (mail, jobs, cache, shield, db, realtime, uploads, logger, monitoring, flags), then platforms and device packages, then the rest. `cli`, `core` and `kitr` have no docs folder: core and cli get a guide each (the app lifecycle, container, config and errors; every CLI command), and `kitr` keeps its content in `docs/entry-points.md`.

<!-- GAPS -->
| Package | Words | Code blocks | Gaps |
| --- | --- | --- | --- |
| actions | 401 | 6 | missing sections: Configure, Testing, Next steps; 401 words, needs 1200; 6 code blocks, needs 15; api.md: 3 export(s) without a doc comment (defineAction, requireSession, ActionContext) |
| analytics | 392 | 4 | missing sections: Configure, Testing, Next steps; 392 words, needs 1200; 4 code blocks, needs 15; api.md: 4 export(s) without a doc comment (consoleAdapter, Analytics, AnalyticsAdapter, PostHogLike) |
| api | 473 | 8 | missing sections: Configure, Testing; 473 words, needs 1200; 8 code blocks, needs 15 |
| auth | 358 | 9 | missing sections: Configure, Testing; 358 words, needs 1200; 9 code blocks, needs 15; api.md: 1 export(s) without a doc comment (tokenAdapter) |
| cache | 414 | 7 | missing sections: Configure, Testing, Next steps; 414 words, needs 1200; 7 code blocks, needs 15; api.md: 5 export(s) without a doc comment (cached, createMemoryCacheDriver, Cache, CacheConfig, …) |
| consent | 327 | 4 | missing sections: Configure, Testing, Next steps; 327 words, needs 1200; 4 code blocks, needs 15; api.md: 7 export(s) without a doc comment (createConsent, useConsent, defineConfig, Consent, …) |
| db | 242 | 4 | missing sections: Configure, Testing, Next steps; 242 words, needs 1200; 4 code blocks, needs 15; api.md: 2 export(s) without a doc comment (defineDb, useDb) |
| desktop | 274 | 4 | missing sections: Configure, Testing, Next steps; 274 words, needs 1200; 4 code blocks, needs 15; api.md: 11 export(s) without a doc comment (desktop, DesktopOptions, DesktopShell, desktopShell, …) |
| devtools | 455 | 4 | missing sections: Configure, Testing, Next steps; 455 words, needs 1200; 4 code blocks, needs 15; api.md: 10 export(s) without a doc comment (createDevtoolsHub, DevtoolsAction, DevtoolsEntry, DevtoolsHub, …) |
| files | 253 | 3 | missing sections: Configure, Testing, Next steps; 253 words, needs 1200; 3 code blocks, needs 15; api.md: 13 export(s) without a doc comment (acceptFor, createMemoryFilesDriver, toBlob, useFiles, …) |
| flags | 420 | 4 | missing sections: Configure, Testing, Next steps; 420 words, needs 1200; 4 code blocks, needs 15; api.md: 11 export(s) without a doc comment (createFlags, defineFlags, defineConfig, FLAGS_SCRIPT_ID, …) |
| forms | 393 | 4 | missing sections: Configure, Testing; 393 words, needs 1200; 4 code blocks, needs 15 |
| http | 409 | 6 | missing sections: Configure, Testing; 409 words, needs 1200; 6 code blocks, needs 15 |
| i18n | 259 | 6 | missing sections: Configure, Testing, Next steps; 259 words, needs 1200; 6 code blocks, needs 15; api.md: 4 export(s) without a doc comment (createI18n, detectLocale, matchLocale, I18nConfig) |
| jobs | 598 | 7 | missing sections: Configure, Testing, Next steps; 598 words, needs 1200; 7 code blocks, needs 15; api.md: 12 export(s) without a doc comment (createJobs, createMemoryJobsDriver, cronMatches, parseInterval, …) |
| logger | 300 | 7 | missing sections: Configure, Testing, Next steps; 300 words, needs 1200; 7 code blocks, needs 15; api.md: 6 export(s) without a doc comment (createLogger, defineConfig, loggerProvider, LoggerOptions, …) |
| mail | 501 | 6 | missing sections: Configure, Testing, Next steps; 501 words, needs 1200; 6 code blocks, needs 15; api.md: 15 export(s) without a doc comment (address, createLogTransport, createResendTransport, formatAddress, …) |
| mobile | 264 | 3 | missing sections: Configure, Testing, Next steps; 264 words, needs 1200; 3 code blocks, needs 15; api.md: 4 export(s) without a doc comment (mobile, MobileOptions, MobileTarget, capacitorPlatform) |
| mocks | 249 | 6 | missing sections: Configure, Testing, Next steps; 249 words, needs 1200; 6 code blocks, needs 15; api.md: 3 export(s) without a doc comment (kitrErrorResponse, mockRoutes, mockValidationError) |
| monitoring | 425 | 5 | missing sections: Configure, Testing, Next steps; 425 words, needs 1200; 5 code blocks, needs 15; api.md: 9 export(s) without a doc comment (consoleReporter, defaultShouldReport, Breadcrumb, CaptureContext, …) |
| native | 315 | 2 | missing sections: Configure, Testing, Next steps; 315 words, needs 1200; 2 code blocks, needs 15; api.md: 24 export(s) without a doc comment (createMemoryNativeDrivers, createNative, useNative, webBiometrics, …) |
| notifications | 286 | 3 | missing sections: Configure, Testing, Next steps; 286 words, needs 1200; 3 code blocks, needs 15; api.md: 11 export(s) without a doc comment (createMemoryNotificationsDriver, createWebNotificationsDriver, useNotifications, defineConfig, …) |
| offline | 338 | 3 | missing sections: Configure, Testing, Next steps; 338 words, needs 1200; 3 code blocks, needs 15; api.md: 5 export(s) without a doc comment (bindOnlineManager, useOffline, defineConfig, Offline, …) |
| platform | 162 | 2 | missing sections: Configure, Testing, Next steps; 162 words, needs 1200; 2 code blocks, needs 15; api.md: 7 export(s) without a doc comment (createPlatform, deepLinkPath, perPlatform, Platform, …) |
| query | 524 | 8 | missing sections: Configure, Testing; 524 words, needs 1200; 8 code blocks, needs 15 |
| react | 373 | 5 | missing sections: Install, Configure, Testing, Next steps; 373 words, needs 1200; 5 code blocks, needs 15; api.md: 4 export(s) without a doc comment (createApp, KitrBoot, useConfig, useService) |
| realtime | 218 | 4 | missing sections: Configure, Testing, Next steps; 218 words, needs 1200; 4 code blocks, needs 15; api.md: 36 export(s) without a doc comment (channel, createSocketClient, parseMessage, stableStringify, …) |
| router | 588 | 5 | missing sections: Configure, Testing, Next steps; 588 words, needs 1200; 5 code blocks, needs 15; api.md: 7 export(s) without a doc comment (can, DefaultNotFound, DefaultPending, CreateKitrRouterOptions, …) |
| secure-storage | 365 | 5 | missing sections: Configure, Testing, Next steps; 365 words, needs 1200; 5 code blocks, needs 15; api.md: 9 export(s) without a doc comment (createMemorySecureStorageDriver, createSecureStorage, createWebSecureStorageDriver, defineConfig, …) |
| seo | 189 | 2 | missing sections: Configure, Testing, Next steps; 189 words, needs 1200; 2 code blocks, needs 15; api.md: 3 export(s) without a doc comment (cacheHeaders, SeoConfig, SeoInput) |
| server | 502 | 6 | missing sections: Configure, Testing; 502 words, needs 1200; 6 code blocks, needs 15 |
| shield | 460 | 6 | missing sections: Configure, Testing, Next steps; 460 words, needs 1200; 6 code blocks, needs 15; api.md: 9 export(s) without a doc comment (cors, csrf, defineConfig, CorsOptions, …) |
| state | 465 | 7 | missing sections: Configure, Testing; 465 words, needs 1200; 7 code blocks, needs 15 |
| storage | 375 | 6 | missing sections: Configure, Testing, Next steps; 375 words, needs 1200; 6 code blocks, needs 15; api.md: 24 export(s) without a doc comment (createAsyncStorageDriver, createMemoryStorageDriver, defineKv, defineStorage, …) |
| table | 342 | 2 | missing sections: Configure, Testing; 342 words, needs 1200; 2 code blocks, needs 15 |
| tailwind | 279 | 4 | missing sections: Configure, Testing, Next steps; 279 words, needs 1200; 4 code blocks, needs 15; api.md: 2 export(s) without a doc comment (cn, TailwindConfig) |
| testing | 254 | 5 | missing sections: Configure, Testing, Next steps; 254 words, needs 1200; 5 code blocks, needs 15; api.md: 4 export(s) without a doc comment (createApp, createTestApp, createApp, createTestApp) |
| theme | 287 | 2 | missing sections: Configure, Testing, Next steps; 287 words, needs 1200; 2 code blocks, needs 15; api.md: 13 export(s) without a doc comment (dataAttrs, pick, vars, defaultTokens, …) |
| updater | 286 | 3 | missing sections: Configure, Testing, Next steps; 286 words, needs 1200; 3 code blocks, needs 15; api.md: 9 export(s) without a doc comment (createMemoryUpdaterDriver, useUpdater, defineConfig, UpdateInfo, …) |
| uploads | 362 | 4 | missing sections: Configure, Testing, Next steps; 362 words, needs 1200; 4 code blocks, needs 15; api.md: 13 export(s) without a doc comment (accepts, upload, defineConfig, UploadedFile, …) |
| web | 352 | 3 | missing sections: Configure, Testing, Next steps; 352 words, needs 1200; 3 code blocks, needs 15; api.md: 3 export(s) without a doc comment (pwaManifest, WebOptions, WebMode) |
<!-- /GAPS -->
