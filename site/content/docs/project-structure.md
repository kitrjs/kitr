---
title: Project structure
description: What each file and folder in a kitr app is for.
---

# Project structure

A new app from the `app` kit looks like this. Folders appear as you add packages, so a `blank` app has fewer.

```
my-app/
├── app/
│   ├── routes/            # one file per page
│   │   ├── __root.tsx     # the layout around every page
│   │   └── index.tsx      # the home page, at /
│   ├── features/          # code grouped by feature: queries, forms, components
│   ├── components/ui/     # components copied in by `kitr ui add`; yours to edit
│   ├── stores/            # app-wide state (kitr add state)
│   ├── app.ts             # creates the app from kitrrc.ts and config/
│   ├── env.ts             # environment variables, validated at startup
│   ├── router.tsx         # creates the router
│   └── routeTree.gen.ts   # generated from app/routes; never edit
├── config/                # one file per package that has options
├── kitrrc.ts              # which packages are installed and wired
├── AGENTS.md              # conventions for coding assistants, kept up to date by kitr add
└── vite.config.ts         # one line: plugins: [kitr()]
```

## The three files that wire everything

**`kitrrc.ts`** lists the kitr packages in the project and their providers. Nothing is discovered by magic: if a package affects your app at startup, it's in this list.

**`config/<package>.ts`** holds one package's options, typed by that package's `defineConfig`. `config/query.ts` configures [Query](/packages/query), `config/http.ts` configures [HTTP](/packages/http), and so on.

**`app/env.ts`** declares your environment variables. Public ones (prefixed `VITE_`) reach the browser; server ones throw if browser code reads them. A missing or malformed variable stops the app at startup with a clear message, not halfway through a request.

## Features, not file types

Group code by what it does for the user rather than what kind of file it is:

```
app/features/projects/
├── queries.ts        # defineQuery / defineMutation for projects
├── project-form.tsx
└── project-list.tsx
```

The generators follow this: `kitr make:queries projects` writes `app/features/projects/queries.ts`.

## Full-stack and backend apps

A `fullstack` app adds server code beside the client:

```
app/
├── api/routes.ts       # API routes (kitr add api)
├── controllers/        # one class per resource
├── actions/            # server actions (kitr add actions)
└── channels/           # realtime channels (kitr add realtime)
```

A `server` app has no `app/routes` or React at all. See [Build an API server without React](/guides/api-server).
