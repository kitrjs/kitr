---
title: Getting started
description: Install kitr, create your first app and add a package, in about five minutes.
---

# Getting started

kitr is a framework made of small packages you add as you need them. A new project is the wiring files and nothing else; `kitr add web site` brings Vite, React and a router, and `kitr add forms` or `kitr add auth` come when your app needs forms or sign-in. Each package is a popular library you may already know (TanStack Query, React Hook Form, Zustand...) with the setup done for you.

You need [Node.js](https://nodejs.org) 22 or newer.

## 1. Install the CLI once

```sh
npm install -g kitr
```

> **Pre-release.** kitr is version 0.1 and is not on npm yet, so `npm install -g kitr` fails today. To try it, run it from a checkout:
>
> ```sh
> git clone https://github.com/kitrjs/kitr && cd kitr
> pnpm install && pnpm build && pnpm -C registry build
> node packages/kitr/bin/kitr.mjs new ../my-app --kit app --registry $PWD/registry/dist
> ```
>
> Use that `node packages/kitr/bin/kitr.mjs` command wherever this page says `kitr`. Once kitr is published, the steps below work as written.

Now `kitr` works in any folder. Inside a project, the global command hands off to the project's own version of kitr, so everyone on the team runs the same one.

Prefer not to install globally? Every command on this site has a picker to switch to `pnpm`, `npx`, `yarn` or `bunx`, and remembers your choice.

## 2. Create an app

```sh
kitr new my-app --kit app
```

A **kit** is a starting set of platforms, packages and files. Pick the one closest to what you're building; you can add or remove packages later, and every kit is itself a package you can read.

| Kit | For | Includes |
| --- | --- | --- |
| `app` (start here) | A logged-in app that talks to an existing API | A web platform with Vite, React and the router, plus HTTP, forms, tables, state, Tailwind, theme, auth, storage, mocks, testing and devtools |
| `blank` | Starting from nothing | Seven wiring files. No platform, no React, no dev server: `kitr add web site` adds them |
| `fullstack` | An app with its own backend | The app kit plus server rendering, an API server, server actions, SEO and realtime channels |
| `server` | An API with no React at all | Server, API routes, database, realtime channels, logger and testing |
| `saas`, `site`, `realtime`, `desktop`, `tauri`, `mobile` | A real application to start from | The base kits plus pages, controllers and tests; see [Kits](/docs/kits) |

`app` is the one to start with. `kitr new my-app` without `--kit` makes a `blank` project, which has no platform and no dev server, so `npm run dev` fails until you run `kitr add web site`.

`kitr new` installs dependencies, sets up git and writes an `AGENTS.md` for coding assistants.

## 3. Run it

```sh
cd my-app
npm run dev
```

Open the URL it prints. Edit `app/pages/home.tsx` and the page updates as you save.

The starter page confirms the app is running, lists the packages installed, shows the next commands to try and links to these docs and to `AGENTS.md`.

## 4. Add a page

Pages are links on the route table in `app/routes.ts`. Add one, pointing at a component file:

```ts
// app/routes.ts
r.page('/projects', { lazy: () => import('./pages/projects') })
```

```tsx
// app/pages/projects.tsx
export default function ProjectsPage() {
  return <h1>Projects</h1>
}
```

It's live at `/projects`, and `<Link to="/projects">` is type-checked everywhere. Or let the CLI write both: `kitr make:page projects`.

## 5. Add a package

Say you want users to save a list of favourites that survives a reload:

```sh
kitr add state
```

That one command installs the package, wires it up and notes the conventions in `AGENTS.md`. Every package page on this site shows exactly what `kitr add` changed, then walks through each task the package supports.

## What next

- [What is kitr](/docs/what-is-kitr): the mental model, and a glossary of the words used here.
- [How kitr compares](/docs/compare): kitr beside Next.js, Remix, Expo and others.
- [Project structure](/docs/project-structure): where everything lives.
- [Configuration](/docs/configuration): `kitrrc.ts`, `config/` and environment variables.
- [Browse packages](/packages): find the pieces your app needs.
- [Loading and saving data](/docs/data): the one idea that ties kitr together.
