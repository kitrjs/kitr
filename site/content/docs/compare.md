---
title: How kitr compares
description: Where kitr overlaps with Next.js, Remix and React Router, TanStack Start, Expo, AdonisJS and Laravel, and when to pick each.
---

# How kitr compares

This page compares kitr with the frameworks it overlaps with. It says where kitr overlaps with each, where it differs, and when the other one is the better choice. If you are coming from Next.js, [Migrate from Next.js](/guides/migrate-from-nextjs) maps each Next.js idea to its kitr equivalent.

## Next.js

Both build React apps with server rendering, static output and an API layer.

Next.js is one framework with its own router, bundler and server conventions. kitr is a set of packages over TanStack Router, Query and Start, and Vite, with pages listed on a route table in `app/routes.ts`.

Pick Next.js when you want the most widely used React framework and its hosting options. Pick kitr when you want the pieces to be separate libraries you can leave.

## Remix and React Router 7

Both lean on web standards and let a route own its data loading.

kitr uses TanStack Router, where loaders, search params and links are typed, and adds query caching and mutation `effects`. It also covers the server, forms, auth and mail through the same CLI.

Pick React Router when you want a focused router with a long track record. Pick kitr when you want the surrounding conventions as well.

## TanStack Start

This is the closest relative: kitr's `web()` platform uses TanStack Start for server rendering, and kitr re-exports TanStack Router and Query, so TanStack knowledge carries over.

Start gives you the framework core. kitr adds a project layout, the `kitrrc.ts` wiring, a package system with generators and a CLI.

Pick Start when you want to make your own choices about everything around it. Pick kitr when you want those choices made and written down.

## Expo

Both aim at one codebase for several platforms.

Expo builds React Native apps that render native views. kitr's mobile and desktop platforms (Capacitor, Electron and Tauri) wrap your web app in a native shell that shows it in a web view.

Pick Expo when you need native views and platform-specific interaction. Pick kitr when your app is a web app that you also want in a shell.

## AdonisJS

kitr borrows from Adonis: explicit wiring in a config file, providers with a lifecycle, a container, controllers and generators. The `server` kit has Adonis-style controllers on h3.

Adonis is a batteries-included Node framework with its own ORM, auth and mail. kitr's server side is lighter, and its front end is React with TanStack.

Pick Adonis for a backend with a full-featured ecosystem. Pick kitr when the same project also has a React front end and you want one CLI for both.

## Laravel

Laravel is the reference point for a framework with an opinion on everything. kitr shares the idea that a CLI and fixed conventions beat assembling libraries by hand, and it has packages for mail, jobs, cache and flags.

Laravel is PHP, with a first-party auth system and hosting products. kitr is TypeScript and has no auth server of its own.

Pick Laravel for a PHP team that wants a complete stack. Pick kitr when your team works in TypeScript end to end.

## At a glance

| | kitr | Next.js | Remix / React Router 7 | TanStack Start | Expo | AdonisJS | Laravel |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Routing | A route table in `app/routes.ts`, over TanStack Router | Files in folders | Route modules, config or files | TanStack Router, files by default | File-based, in the Expo router | Route file in code | Route file in code |
| Data loading | Query contracts and loaders, cache effects | Server components and fetch | Loaders and actions | Loaders and server functions | Your choice of library | Controllers | Controllers |
| Server | `server()` on h3, or Start | Built in | Built in | Built in | Not the focus | Core of the framework | Core of the framework |
| Native apps | Yes, web view shells | No | No | No | Yes, React Native | No | No |
| How opinions are enforced | `kitr add`, generators, `kitr doctor`, `AGENTS.md` | Conventions and lint rules | Conventions | Few | Templates and config plugins | Generators and conventions | Conventions and tooling |
| Leaving | Rewrite imports to the upstream libraries (`kitr eject all` prints it) | Rewrite to another framework | Rewrite loaders and routes | Small | Rewrite native parts | Rewrite to another backend | Rewrite to another backend |

Cells for other frameworks are general. Check their own documentation for current behaviour.

## What kitr does not have

- No auth server. The `auth` package works with the one you run.
- Native shells are web views, not React Native.

## Next steps

- [What is kitr](/docs/what-is-kitr): the mental model.
- [Getting started](/docs/getting-started): install kitr and create an app.
- [Migrate from Next.js](/guides/migrate-from-nextjs): a step-by-step mapping.
- [Design decisions](/docs/design): the rules behind kitr's architecture.
