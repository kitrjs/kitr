---
title: Getting started
description: Install kitr, create your first app and add a package, in about five minutes.
---

# Getting started

kitr is a React framework made of small packages you add as you need them. You start with a router and data loading, then run `kitr add forms` or `kitr add auth` when your app needs forms or sign-in. Each package is a popular library you may already know (TanStack Query, React Hook Form, Zustand...) with the setup done for you.

You need [Node.js](https://nodejs.org) 22 or newer.

## 1. Install the CLI once

```sh
npm install -g kitr
```

Now `kitr` works in any folder. Inside a project, the global command hands off to the project's own version of kitr, so everyone on the team runs the same one.

Prefer not to install globally? Every command on this site has a picker to switch to `pnpm`, `npx`, `yarn` or `bunx`, and remembers your choice.

## 2. Create an app

```sh
kitr new my-app --kit app
```

A **kit** is a starting set of packages. Pick the one closest to what you're building; you can add or remove packages later.

| Kit | For | Includes |
| --- | --- | --- |
| `blank` | Learning, or starting from nothing | Router and query |
| `app` | A logged-in app that talks to an existing API | Plus HTTP, forms, tables, state, UI, auth, mocks and testing |
| `fullstack` | An app with its own backend | The app kit plus server rendering, server actions, API routes and realtime channels |
| `server` | An API with no React at all | Server, API routes, database, realtime channels, logger and testing |

`kitr new` installs dependencies, sets up git and writes an `AGENTS.md` for coding assistants.

## 3. Run it

```sh
cd my-app
npm run dev
```

Open the URL it prints. Edit `app/routes/index.tsx` and the page updates as you save.

## 4. Add a page

Every file in `app/routes` is a page. Create `app/routes/projects.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/projects')({
  component: () => <h1>Projects</h1>,
})
```

It's live at `/projects`. Or let the CLI write it: `kitr make:route projects`.

## 5. Add a package

Say you want users to save a list of favourites that survives a reload:

```sh
kitr add state
```

That one command installs the package, wires it up and notes the conventions in `AGENTS.md`. Every package page on this site starts with a live example, then shows exactly what `kitr add` changed.

## What next

- [Project structure](/docs/project-structure): where everything lives.
- [Configuration](/docs/configuration): `kitrrc.ts`, `config/` and environment variables.
- [Browse packages](/packages): find the pieces your app needs.
- [Loading and saving data](/docs/data): the one idea that ties kitr together.
