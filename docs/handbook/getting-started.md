---
title: Getting started
description: Install kitr, create your first app and add a package, in about five minutes.
---

# Getting started

kitr is a framework made of small packages you add as you need them. A new project starts as the wiring files; `kitr add web site` brings Vite, React and a router, and `kitr add forms` or `kitr add auth` come when your app needs forms or sign-in. Each package is a popular library you may already know (TanStack Query, React Hook Form, Zustand...) with the setup done for you.

> [!SUMMARY]
> Two commands get you a running app: `npm install -g @kitr/kitr`, then `kitr new my-app --kit app`. Run `npm run dev` inside the folder and open the URL it prints.

You need [Node.js](https://nodejs.org) 22 or newer.

## 1. Install the CLI once

```sh
npm install -g @kitr/kitr
```

Now `kitr` works in any folder. Inside a project, the global command hands off to the project's own version of kitr, so everyone on the team runs the same one.

Prefer not to install globally? Every command on this site has a picker to switch to `pnpm`, `npx`, `yarn` or `bunx`, and remembers your choice.

## 2. Create an app

```sh
kitr new my-app --kit app
```

A **kit** is a starting set of platforms, packages and files. Pick the one closest to what you're building; you can add or remove packages later, and every kit is itself a package you can read.

| Kit | For |
| --- | --- |
| `app` (start here) | The smallest app that runs: pages, data loading and styling |
| `dashboard` | A logged-in app that talks to an existing API: forms, tables, auth, mocks |
| `fullstack` | An app with its own backend, server rendering and realtime |
| `server` | An API with no React at all |
| `blank` | Starting from nothing: seven wiring files |

[Kits](/docs/kits) lists the rest, including `saas`, `site`, `realtime`, `desktop`, `tauri` and `mobile`.

> [!WARNING] Blank projects have no dev server
> `kitr new my-app` without `--kit` makes a `blank` project, so `npm run dev` fails until you run `kitr add web site`. Use `--kit app` to start with a working page.

`kitr new` installs dependencies, sets up git and writes an `AGENTS.md` for coding assistants.

## 3. Run it

```sh
cd my-app
npm run dev
```

Open the URL it prints. Edit `app/pages/home.tsx` and the page updates as you save; the starter page also shows the next commands to try.

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

## Next steps

- [Use a package](/packages): find the pieces your app needs.
- [Configuration](/docs/configuration): `kitrrc.ts`, `config/` and environment variables.
- [Add your own code](/docs/extending): your own state, services and drivers.
