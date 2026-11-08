---
title: How kitr compares
description: Where kitr overlaps with Next.js, Remix and React Router, TanStack Start, Expo, AdonisJS and Laravel, and when to pick each.
---

# How kitr compares

kitr is young, with a small community. The frameworks below are older and better proven. Coming from Next.js? [Migrate from Next.js](/guides/migrate-from-nextjs) maps each idea to kitr.

## Next.js

Next.js is one framework with its own router, bundler and server, and a large ecosystem. kitr is a set of separate packages over TanStack and Vite, with pages listed in `app/routes.ts` instead of folders. Pick Next.js for the most widely used React framework and its hosting. Pick kitr when you want pieces you can swap out.

## Remix and React Router 7

React Router is a focused router with a long track record, and you can adopt it one page at a time. kitr uses TanStack Router, where links and search params are typed, and also covers the server, forms, auth and mail. Pick React Router for just the router. Pick kitr when you want the rest decided too.

## TanStack Start

The closest relative: kitr's `web()` platform runs on Start, so TanStack knowledge carries over. kitr adds a project layout, `kitrrc.ts`, packages, generators and a CLI. Use Start directly to make those choices yourself; use kitr to have them made for you.

## Expo

Expo builds React Native apps with native views and a mature toolchain. kitr's mobile and desktop platforms wrap your web app in a native shell instead. Pick Expo when you need native views. Pick kitr when your app is a web app you also want on phones and desktops.

## AdonisJS

kitr borrows a lot from Adonis: config-file wiring, providers, a container, controllers and generators. Adonis is a mature backend framework with its own ORM, auth and mail. Pick Adonis for a full-featured backend. Pick kitr when the same project also has a React front end.

## Laravel

Laravel has an answer for everything: queues, mail, auth, a command line, hosting. kitr shares the idea that conventions beat wiring libraries by hand, but it is TypeScript and much younger. Pick Laravel for a proven PHP stack. Pick kitr for TypeScript end to end.

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
- The stack is new, so there are fewer answers online and fewer people who know it.

## Next steps

- [What is kitr](/docs/what-is-kitr): the mental model.
- [Getting started](/docs/getting-started): install kitr and create an app.
- [Migrate from Next.js](/guides/migrate-from-nextjs): a step-by-step mapping.
- [Design decisions](/docs/design): where kitr deliberately differs from the obvious approach.
