---
title: Create a package
description: Write a kitr package that `kitr add` installs and wires, with a config file, a container service, a CLI command, a generator, doctor checks and docs.
packages: server, testing
time: 45 min
---

# Create a package

Every official kitr package is an ordinary npm package that ships one extra module, and so is yours. The CLI knows no package by name: `kitr add @acme/slack` runs the same steps as `kitr add mail`. It installs the package, asks its questions, registers its provider, writes its config file and documents it for agents. So a team can package the wiring it copies between projects once, and every project gets it with one command.

You will build `@acme/slack`, which posts messages to a Slack channel from the server. By the end, `kitr add @acme/slack` writes `config/slack.ts` and the env variable, registers a provider that binds a typed `slack` service, adds `kitr slack:ping` to the CLI and `kitr make:notification` to the generators, and warns in `kitr doctor` when a webhook URL is committed to the repository.

## Before you start

You need [Node.js](https://nodejs.org) 22 or newer, [pnpm](https://pnpm.io) and a kitr project to try the package in, such as one made with `kitr new acme-api --kit server`. A Slack [incoming webhook](https://api.slack.com/messaging/webhooks) URL lets you see a real message; without one, the package logs messages instead of sending them.

Read [Building a package](/docs/building-packages) for the manifest fields, and keep the [package contract](/docs/package-contract) open: it lists every method this guide uses.

## Lay out the package

A kitr package has the runtime code apps import, a provider, a setup module for the CLI, and docs:

```
acme-slack/
├── src/
│   ├── index.ts        # createSlack(), defineConfig(), types: what apps import
│   ├── provider.ts     # binds the `slack` service at boot
│   ├── kitr.ts         # the setup module: kitr add, remove, doctor, make:*
│   ├── commands.ts     # kitr slack:ping
│   └── slack.test.ts
├── docs/
│   └── index.md        # listed on kitr.dev with the package
├── package.json
└── tsdown.config.ts
```

The `package.json` exports each module, declares the `kitr` block the CLI and kitr.dev read without running anything, and takes `@kitr/core` as a peer dependency, so the app's copy is the one your provider registers with:

```json
{
  "name": "@acme/slack",
  "version": "0.1.0",
  "description": "Post messages to Slack from a kitr server.",
  "keywords": ["kitr", "kitr-package"],
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./provider": { "types": "./dist/provider.d.ts", "default": "./dist/provider.js" },
    "./kitr": { "types": "./dist/kitr.d.ts", "default": "./dist/kitr.js" },
    "./package.json": "./package.json"
  },
  "files": ["dist", "docs"],
  "scripts": {
    "build": "tsdown",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@kitr/core": ">=0.1.0"
  },
  "devDependencies": {
    "@kitr/core": "^0.1.0",
    "@kitr/testing": "^0.1.0",
    "tsdown": "^0.23.7",
    "typescript": "^5.9.3",
    "vitest": "^5.1.0"
  },
  "kitr": {
    "name": "slack",
    "title": "Slack",
    "summary": "Post messages to a Slack channel when something happens in your app.",
    "category": "backend",
    "runsOn": "server",
    "requires": ["server"],
    "docs": "docs",
    "setup": "./kitr"
  }
}
```

| Field | Why it matters |
| --- | --- |
| `keywords: ["kitr-package"]` | How kitr.dev will find community packages to list. |
| `exports["./kitr"]` | The setup module. The CLI loads `@acme/slack/kitr` from the installed package. |
| `kitr.name` | The short name: `config/slack.ts`, the `slack:` command prefix, the `## kitr: slack` section in `AGENTS.md`. |
| `kitr.summary` | One plain sentence, 140 characters at most. It must equal the `description` in `docs/index.md`. |
| `kitr.requires` | Packages added first. `server` means `kitr add @acme/slack` in a project without a server adds one. |

Build every entry with [tsdown](https://tsdown.dev):

```ts
// tsdown.config.ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/provider.ts', 'src/kitr.ts', 'src/commands.ts'],
  dts: true,
})
```

## Write what apps import

Start with the code that does the work. It knows nothing about kitr's CLI. Declare the config type, a typed `defineConfig` for `config/slack.ts`, and the service:

```ts
// src/index.ts
import { createDefineConfig } from '@kitr/core'

export interface SlackMessage {
  text: string
  /** Overrides the webhook's default channel, when the webhook allows it. */
  channel?: string
}

export interface SlackConfig {
  /** The incoming webhook URL. Without one, messages are logged instead of sent. */
  webhookUrl?: string
  /** Prefix for every message, such as the environment: `[staging]`. */
  prefix?: string
}

export interface Slack {
  /** Post one message. Resolves when Slack accepted it. */
  post(message: SlackMessage | string): Promise<void>
  /** Messages logged because no webhook is set, newest last. */
  readonly logged: readonly SlackMessage[]
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    slack: SlackConfig
  }
  interface ContainerBindings {
    slack: Slack
  }
}

/** Types `config/slack.ts`. Returns its argument unchanged. */
export const defineConfig = createDefineConfig<SlackConfig>()

export function createSlack(config: SlackConfig): Slack {
  const logged: SlackMessage[] = []
  return {
    logged,
    async post(input) {
      const message = typeof input === 'string' ? { text: input } : input
      const text = config.prefix ? `${config.prefix} ${message.text}` : message.text
      if (!config.webhookUrl) {
        logged.push({ ...message, text })
        console.info(`[slack] ${text}`)
        return
      }
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...message, text }),
      })
      if (!res.ok) throw new Error(`[acme/slack] Slack answered ${res.status}: ${await res.text()}`)
    },
  }
}
```

The `declare module '@kitr/core'` block is what makes the service typed in every app. With it, `app.config.get('slack')` returns a `SlackConfig` and `app.container.use('slack')` returns a `Slack`, with no casts.

## Bind the service in a provider

A provider connects your code to the app's lifecycle. `register` binds services and runs once at boot:

```ts
// src/provider.ts
import { defineProvider } from '@kitr/core'
import { createSlack, type SlackConfig } from './index'

export const slackProvider = defineProvider({
  name: 'slack',
  register(app) {
    if (app.isClient) return
    const config = app.config.get('slack', {} as SlackConfig)
    if (app.isProduction && !config.webhookUrl)
      throw new Error('[acme/slack] Set SLACK_WEBHOOK_URL: production would log every message instead of sending it.')
    app.container.singleton('slack', () => createSlack(config))
  },
})

export default slackProvider
```

`singleton` builds the service the first time something asks for it, then reuses it. The production check follows the same rule as [Mail](/packages/mail): a setup that silently drops messages in production should refuse to boot, not fail quietly for a week.

| Hook | Runs | Use it for |
| --- | --- | --- |
| `register(app)` | First, for every provider | Binding services. No I/O. |
| `boot(app)` | After every provider registered | Work that needs other services, such as connecting. |
| `ready(app)` | The server is listening (servers only) | Announcing the server is up. |
| `shutdown(app)` | The server is stopping (servers only) | Closing connections. |

## Write the setup module

The setup module is what `kitr add` runs. It describes the change to the project, and the CLI applies it: every call is queued, idempotent and printed by `--dry-run`:

```ts
// src/kitr.ts
import { definePackage, naming } from '@kitr/core/package'

const config = (prefix: string) => `import { defineConfig } from '@acme/slack'

export default defineConfig({
  // Without a webhook, messages are logged. Production refuses to boot without one.
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  prefix: ${JSON.stringify(prefix)},
})
`

export default definePackage({
  name: 'slack',
  requires: ['server'],
  questions: [
    { name: 'prefix', type: 'text', message: 'Prefix for every message?', default: '[acme]' },
  ],
  add(ctx) {
    ctx.provider.add('@acme/slack/provider')
    ctx.config('slack', config(String(ctx.answers.prefix ?? '[acme]')))
    ctx.env.schema('server', 'SLACK_WEBHOOK_URL', 'e.url({ optional: true })', '')
    ctx.agents.add(
      'slack',
      "- Post to Slack on the server with `ctx.app.container.use('slack').post('text')`. The webhook is `SLACK_WEBHOOK_URL`; without it, messages are logged. Message builders live in `server/notifications/` (`kitr make:notification <name>`).",
    )
  },
  remove(ctx) {
    ctx.provider.remove('@acme/slack/provider')
    ctx.agents.remove('slack')
  },
  commands: () => import('./commands'),
  generators: {
    notification: {
      description: 'A Slack message builder in server/notifications',
      target: (name) => ({ file: `server/notifications/${naming.snake(name)}.ts` }),
      stub: ({ name }) => `import type { SlackMessage } from '@acme/slack'

export interface ${naming.pascal(name)}Data {
  title: string
}

/** Send with \`app.container.use('slack').post(${naming.camel(name)}(data))\`. */
export function ${naming.camel(name)}(data: ${naming.pascal(name)}Data): SlackMessage {
  return { text: \`${naming.pascal(name)}: \${data.title}\` }
}
`,
    },
  },
  doctor(project) {
    if (!project.exists('config/slack.ts')) return []
    if (project.read('config/slack.ts').includes('hooks.slack.com'))
      return [
        {
          level: 'error',
          message: 'config/slack.ts contains a webhook URL: anyone with the repository can post to your channel',
          fix: 'Move it to SLACK_WEBHOOK_URL in the environment and rotate the webhook in Slack',
        },
      ]
    return []
  },
  vite: { serverOnlyConfig: true },
})
```

Line by line:

- `requires: ['server']` adds the server package first, with its own questions, when the project has none.
- `questions` become prompts in a terminal and flags everywhere else: `kitr add @acme/slack --prefix "[staging]"`. In CI, or with `--yes`, the default is taken, so nothing ever waits for input.
- `ctx.provider.add` puts `() => import('@acme/slack/provider')` into the `providers` list in `kitrrc.ts`.
- `ctx.config('slack', ...)` writes `config/slack.ts`, unless the file exists, so running `kitr add` again never overwrites a user's edits.
- `ctx.env.schema` declares the variable in `app/env.ts` and adds it to `.env.example`.
- `ctx.agents.add` writes a `## kitr: slack` section in `AGENTS.md`, so coding agents use the service instead of adding a Slack SDK by hand.
- `vite.serverOnlyConfig` keeps `config/slack.ts` out of browser bundles, because it reads `process.env`.

`remove` undoes what `add` did to the wiring files. It leaves `config/slack.ts` and the generated notifications in place; the CLI lists the files that still import the package so the user can decide.

Keep the setup module free of Node imports and heavy dependencies. The CLI loads it on every `kitr add`, `kitr doctor` and `kitr make:*`, and loads `commands` only when one runs.

## Add a command

Commands are plain objects in [citty](https://github.com/unjs/citty)'s shape, so the package needs no CLI dependency. Export them by name; the `slack:` prefix keeps them from colliding with other packages:

```ts
// src/commands.ts
import { createSlack } from './index'

export const ping = {
  meta: { name: 'slack:ping', description: 'Send a test message to the Slack webhook.' },
  args: {
    text: { type: 'string', description: 'Message to send', default: 'Hello from kitr' },
  },
  async run({ args }: { args: { text: string } }) {
    try {
      process.loadEnvFile('.env')
    } catch {}
    const url = process.env.SLACK_WEBHOOK_URL
    if (!url) {
      console.error('SLACK_WEBHOOK_URL is not set. Add it to .env.')
      process.exitCode = 1
      return
    }
    await createSlack({ webhookUrl: url }).post(args.text)
    console.log('Sent.')
  },
}

export default { 'slack:ping': ping }
```

Commands run in the project's root, so `.env` is the project's. Node's `process.loadEnvFile` reads it; the `try` covers projects that set the variable in the shell instead.

## Try it in a project

Build the package, then install it into a project from its folder:

```sh
cd acme-slack && pnpm build
cd ../acme-api
pnpm add ../acme-slack
kitr add @acme/slack --dry-run
```

`--dry-run` prints the plan without touching a file. Run it for real:

```sh
kitr add @acme/slack --prefix "[dev]"
```

The CLI finds `@acme/slack` already installed, loads `@acme/slack/kitr` and applies it. The project now has:

- `() => import('@acme/slack/provider')` in `providers` in `kitrrc.ts`, and `@acme/slack` in `packages`.
- `config/slack.ts` with `prefix: "[dev]"`.
- `SLACK_WEBHOOK_URL` in `app/env.ts` and `.env.example`.
- A `## kitr: slack` section in `AGENTS.md`.

Use the service from a controller:

```ts
// server/controllers/invoices-controller.ts
import type { HttpContext } from '@kitr/api'

export default class InvoicesController {
  async pay({ app, params }: HttpContext<{ id: string }>) {
    await app.container.use('slack').post(`Invoice ${params.id} was paid`)
    return { id: params.id, status: 'paid' }
  }
}
```

Without a webhook, the server log shows `[slack] [dev] Invoice inv_1001 was paid`. Put a webhook URL in `.env`, restart, and the message lands in the channel. Then try the rest:

```sh
kitr slack:ping --text "Deploys are back"
kitr make:notification deploy_finished
kitr doctor
```

`make:notification` writes `server/notifications/deploy_finished.ts` with a `deployFinished()` builder. `kitr --help` lists `slack:ping` after the core commands. A user who wants a different stub runs `kitr eject stub notification` and edits `stubs/notification.ts`; `make:notification` prefers it from then on.

## Test the package

Test the service on its own, and the provider inside a booted app with `createTestApp` from [Testing](/packages/testing):

```ts
// src/slack.test.ts
import { createTestApp } from '@kitr/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSlack } from './index'
import slackProvider from './provider'

afterEach(() => vi.unstubAllGlobals())

describe('@acme/slack', () => {
  it('logs instead of sending without a webhook', async () => {
    const slack = createSlack({ prefix: '[test]' })
    await slack.post('Invoice inv_1001 was paid')
    expect(slack.logged).toEqual([{ text: '[test] Invoice inv_1001 was paid' }])
  })

  it('posts JSON to the webhook', async () => {
    const fetch = vi.fn(async () => new Response('ok'))
    vi.stubGlobal('fetch', fetch)
    await createSlack({ webhookUrl: 'https://hooks.slack.test/T1' }).post({ text: 'Hi', channel: '#billing' })
    expect(fetch).toHaveBeenCalledWith('https://hooks.slack.test/T1', expect.objectContaining({ method: 'POST' }))
  })

  it('binds the service from config', async () => {
    const app = await createTestApp({ providers: [slackProvider], config: { slack: { prefix: '[test]' } } })
    await app.container.use('slack').post('Booted')
    expect(app.container.use('slack').logged).toEqual([{ text: '[test] Booted' }])
  })

  it('refuses to boot in production without a webhook', async () => {
    await expect(createTestApp({ providers: [slackProvider], mode: 'production' })).rejects.toThrow('SLACK_WEBHOOK_URL')
  })
})
```

Packages import `@kitr/testing` directly; apps import the same helpers as `@kitr/testing`.

## Write the docs

The `docs/` folder ships with the package and is what kitr.dev shows on the package's page. Start `docs/index.md` with the same sentence as `kitr.summary`:

```md
---
title: Slack
description: Post messages to a Slack channel when something happens in your app.
order: 1
---

# Slack

Deploy finished, invoice paid, sign-up from a big customer: teams want to hear about it where they already talk. ...
```

Follow the order every official package uses, so readers know where to look: Install (with every change `kitr add` makes), Configure (the full `config/slack.ts` and a table of options), a first example, one section per task, Commands, Testing, Next steps. [docs/STYLE.md](https://github.com/kitrjs/kitr/blob/main/docs/STYLE.md) has the rules. Then check the package the way the registry will:

```sh
kitr package:check
```

```txt
✓ manifest and docs look good
```

It fails with a list when the `kitr` block is invalid, the `kitr-package` keyword is missing, `docs` is not in `files`, or the description and summary disagree.

## Publish it

```sh
pnpm build
pnpm test
npm publish --access public
```

Anyone can now run `kitr add @acme/slack`: the CLI installs it from npm, then runs the same setup module you tried locally. To keep a package private to your company, publish it to your private registry; `kitr add` installs through the project's package manager, so it uses the registry the project is configured for.

When `@kitr/core` releases a new major version, test against it and widen the peer range. `kitr upgrade` moves a project's `@kitr/*` packages together, and a peer range that excludes the new version shows up as a warning on install.

## Next steps

- [Package contract](/docs/package-contract): every `ctx` method, question type and setup field.
- [Building a package](/docs/building-packages): the manifest, docs and live examples on kitr.dev.
- [Keep several apps in one repository](/guides/monorepo): use a package like this from a workspace without publishing it.
- [Mail](/packages/mail): an official package built the same way, with a provider, a config file, a generator and a production check.
