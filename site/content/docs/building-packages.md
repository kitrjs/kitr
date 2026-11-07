---
title: Building a package
description: Write a kitr package that the CLI can install and this site can list, with docs and a live example.
---

# Building a package

Every package on this site, official or not, is an ordinary npm package with three additions: a `kitr` block in its `package.json`, a `docs` folder, and optionally an `examples` folder. Nothing is registered by hand. Publish it with the `kitr-package` keyword and it can be listed here.

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
| `category` | yes | One of `data-fetching`, `app-state`, `backend`, `realtime`, `interface`, `forms`, `auth`, `pages`, `platforms`, `device`, `insights`, `dev-tools`. Sets the colour and filter on the packages page. |
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

Every question is also a flag (`kitr add stripe --mode embedded`), so agents and CI never see a prompt. `add` and `remove` get codemods for the files kitr owns: `kitrrc.ts` providers, `config/<name>.ts`, `package.json` scripts and dependencies, `.env.example`, `AGENTS.md`, `tsconfig.json`, `vite.config.ts` and the route table; `ctx.write` and `ctx.edit` cover anything else. Add `"setup": "./kitr"` to the manifest and build the module beside your runtime code. The full contract, with every `ctx` method, is in the [package contract](/docs/package-contract) reference.

## Publishing

```sh
npm publish
```

Use the `kitr-package` keyword. Community listings are on the way: a weekly sync will pick up packages with that keyword and list them under Community, with a health badge based on recent releases and the kitr versions they support.
