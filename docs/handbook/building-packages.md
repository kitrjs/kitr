---
title: Building a package
description: Write a kitr package that the CLI can install and this site can list, with docs and a live example.
---

# Building a package

Every package on this site, official or not, is an ordinary npm package with three additions: a `kitr` block in its `package.json`, a `docs` folder, and optionally an `examples` folder. Publish it with the `kitr-package` keyword and it can be listed here.

## The manifest

```json
{
  "name": "kitr-stripe",
  "version": "1.0.0",
  "keywords": ["kitr", "kitr-package"],
  "files": ["dist", "docs"],
  "kitr": {
    "name": "stripe",
    "title": "Stripe",
    "summary": "Take card payments and subscriptions, with checkout pages you can restyle.",
    "category": "backend",
    "runsOn": "both",
    "builtOn": ["stripe"],
    "requires": ["server"],
    "docs": "docs"
  }
}
```

| Field | Required | Description |
| --- | --- | --- |
| `name` | yes | The short name people type: `kitr add stripe`. |
| `title` | yes | Display name on this site. |
| `summary` | yes | One sentence, 140 characters at most, on what it does for the app. See below. |
| `category` | yes | Where the package is listed: `data-fetching`, `app-state`, `backend`, `realtime`, `interface`, `forms`, `auth`, `pages`, `platforms`, `device`, `insights`, `dev-tools` or `kits`. |
| `kind` | | `package` (default), `platform` (added as `kitr add <type> <name>`) or `kit` (run by `kitr new --kit <name>`). |
| `runsOn` | yes | `client`, `server` or `both`. Shown as a badge. |
| `builtOn` | | Upstream libraries it wraps, shown as "Built on". |
| `requires` | | Other kitr packages that must be added first. |
| `client` | | `true` if it needs a React frontend, so server-only projects refuse it. |
| `docs` | | The docs folder, relative to the package root. Include it in `files`. |

## Writing the summary

The summary is the first thing a beginner reads on the packages page, so it answers *what will this do for my app?* in plain words:

- **Good:** "Show rows of data with sorting, paging and filters that stay in the URL."
- **Not:** "TanStack Table v9 with URL-bound state." That only helps people who already know TanStack.

Put library names in `builtOn`, where they show as a separate note.

## Docs

```
docs/
├── index.md   # overview: what it's for, install, a working example, guides, configuration
└── api.md     # reference: every export, option and type
```

Each file starts with frontmatter:

```md
---
title: Stripe
description: Take card payments and subscriptions, with checkout pages you can restyle.
order: 1
---
```

The `description` of `index.md` must match the manifest `summary`. Follow the order the official packages use, so readers always know where to look:

1. **What it's for**, in two or three sentences, and when *not* to use it.
2. **Install**: the `kitr add` command and what it changes.
3. **A first working example** they can paste.
4. **Guides** for the common tasks.
5. **Configuration**: a table of every option with its default.
6. **Next steps**: the API page and the upstream docs.

Shell blocks that only contain `kitr` commands get the package-manager picker automatically. Link to other packages as `/packages/<name>`.

Follow [docs/STYLE.md](https://github.com/kitrjs/kitr/blob/main/docs/STYLE.md) in the repo for the full rulebook. Check the manifest and docs before publishing:

```sh
kitr package:check
```

## Live examples

Each `examples/<name>.tsx` becomes a live demo at the top of the package page, running in a sandboxed frame with a refresh button so readers can see what persists.

```tsx
// examples/checkout.tsx
export const meta = {
  title: 'Checkout',
  description: 'Pay with a test card. Reload to see the order is kept.',
}

export default function Example() {
  return <CheckoutButton priceId="price_test_123" />
}
```

Anything an example stores in the browser is namespaced to it, so examples never see each other's data.

Style an example with Tailwind utilities on the kitr tokens (`bg-primary`, `text-muted-foreground`, `border-border`), not class names of your own: the site compiles the examples' classes, and the example looks the same in any kitr app that has [tailwind](/packages/tailwind). Keep repeated strings in a constant at the top of the file:

```tsx
const button =
  'min-h-[38px] cursor-pointer rounded-lg border border-border bg-background px-3.5 font-semibold'
```

## Setup with kitr add

To let `kitr add stripe` wire your package, export a setup module as `./kitr`:

```ts
// src/kitr.ts
import { definePackage } from '@kitr/core/package'

export default definePackage({
  name: 'stripe',
  requires: ['server'],
  questions: [
    { name: 'mode', type: 'select', message: 'Checkout mode?', default: 'hosted',
      options: [{ value: 'hosted' }, { value: 'embedded' }] },
  ],
  add(ctx) {
    ctx.provider.add('kitr-stripe/provider')
    ctx.config('stripe', `export default { mode: '${ctx.answers.mode}' }\n`)
    ctx.env.add({ STRIPE_SECRET_KEY: 'sk_test_...' })
    ctx.agents.add('stripe', '- Payments go through the `stripe` service ...')
  },
  remove(ctx) {
    ctx.provider.remove('kitr-stripe/provider')
    ctx.agents.remove('stripe')
  },
  commands: () => import('./commands'),   // `kitr stripe:sync-products`
  generators: { webhook: { description: 'A Stripe webhook handler', target, stub } },
})
```

A generator follows the app's [project structure](/docs/project-structure) when its `target` is one call to `generatorFile` from `@kitr/core/package`, which handles kebab-casing, the kind suffix and nested names (`make:webhook billing/refunds` writes `server/webhooks/billing/refunds-webhook.ts`):

```ts
import { generatorFile } from '@kitr/core/package'

const webhook = {
  description: 'Create a Stripe webhook handler in server/webhooks',
  definition: 'A handler for one Stripe event type.', // shown by `kitr make`
  target: (name, project) => generatorFile(project, 'server', 'webhooks', name, { suffix: '-webhook' }),
  stub: ({ name, pascal }) => `export default async function handle${pascal}Webhook() {}\n`,
}
```

Every question is also a flag: `kitr add stripe --mode embedded`. `add` and `remove` get helpers for the files kitr owns, such as `kitrrc.ts`, `config/<name>.ts` and `package.json`; `ctx.write` and `ctx.edit` cover anything else. Add `"setup": "./kitr"` to the manifest. Every `ctx` method is in the [package contract](/docs/package-contract).

A platform or a kit is the same package with a `kind`: a platform adds a `platform` block with its `definePlatform` factory, a kit adds a `kit` block naming the platforms, packages, components and files `kitr new --kit` sets up. The [kits](/docs/kits) page shows a complete kit.

## Publishing

```sh
npm publish
```

Add the `kitr-package` keyword so the package can be found.
