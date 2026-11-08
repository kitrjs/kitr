# Design decisions

The rules behind kitr's architecture, and what each means for your code.

## Re-export, never re-implement

A `@kitr/*` package hands you the upstream library unchanged and adds a thin layer on top. The libraries' own docs keep applying, and leaving kitr means rewriting imports. In your code, import from `@kitr/<name>` and read the upstream docs for everything kitr does not mention.

## Everything the app loads is listed in one file

`kitrrc.ts` names the packages, providers and platforms, and `config/<name>.ts` holds each package's options. In your code, read those two places to know what runs at startup, and edit them by hand if you like.

## Platforms are packages

Where an app runs is a platform package (`@kitr/web`, `@kitr/server`, `@kitr/desktop`, `@kitr/mobile`) built on one contract. Because the platform is a package, a project starts with only the core and the CLI, and `kitr dev`, `kitr build` and `kitr start` treat every platform the same way. In your code, add the platforms you need and name them in `kitrrc.ts`.

## Pages are links on a table, not files

Pages, endpoints and sockets are entries on one route table instead of files in folders. One table shape serves the browser and the server, and `kitr add` can edit the list with a codemod. In your code, add a page with `.page()` in `app/routes.ts`; links, loaders and search params are TanStack Router's.

## Typed from the server routes

The API client gets its types from your route table and controllers through the compiler: change a route and the client's types change with it. Types are erased at run time, so `kitr api:sync` writes one small generated file with each route's name, method and path (and the OpenAPI document); `kitr build` runs it for you.

## Queries and mutations are named contracts

Every data source describes its reads, writes and live updates in the same shape, and a mutation declares which cached data it makes stale. Components never know which source they use, so you can swap a REST endpoint for a server action without touching them.

## State lives on the app, not in modules

There is one app per browser tab, per server process and per test, plus a fork of the app for each server request. Request data lives on that request's fork, so one visitor's data cannot reach another's page. In your code, register services in a provider and read them with `useService()`, never from a module-level variable.

## A native shell without a driver fails loudly

In Electron, Tauri or Capacitor, a device package with no driver throws `E_DRIVER_UNAVAILABLE` instead of quietly using the web version. Web code must never pass for native, for example secrets kept in WebView storage. In your code, opt in to the web driver with `fallbackToWeb: true` when you want it.

## Packages ship their own setup

Each package carries its own `kitr add` steps, generators and docs. Adding or removing a package therefore changes your project in a known, listed way. In your code, run `kitr add` instead of wiring by hand, and read what it changed under each package's Install section.

## The CLI is for agents too

Every command runs from flags, prints plain output and supports `--dry-run`. Coding agents and CI can run anything a person can. In your code, expect no prompts; every question has a flag.

## Next steps

- [Entry points](/docs/entry-points): the import rules behind re-exporting.
- [Package contract](/docs/package-contract): how a package carries its own setup.
