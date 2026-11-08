---
title: Overview
description: React with the kitr app in context, so every component can reach services and config.
order: 0
---

# React

Every component in a real app needs something from outside itself: the HTTP client, the signed-in user, a feature flag, the theme. The usual answers are singletons imported from everywhere, props drilled through five layers, or a hand-written context per service. All three make components hard to test and hard to move.

`@kitr/react` puts the kitr app object in React context, so any component reaches a service or a config file with one hook.

## What it is

`@kitr/react` is the bridge between the kitr app and React. `KitrProvider` puts the app in context; `KitrBoot` boots it (runs every provider, binds every service) before rendering, or lets you render first with Suspense. Three hooks do the rest: `useApp` for the app itself, `useService` for anything bound in the container, `useConfig` for a config file. Other packages build on it: [router](/packages/router) renders inside `KitrProvider`, and every package's hooks call `useService` underneath.

It runs on the client, and on the server during server rendering. A server-only project has no React at all; use [server](/packages/server) and reach services through `app.container` there.

## Built on

`@kitr/react` is built on [React](https://react.dev) context and Suspense, and on the kitr core's app object: the container, the provider lifecycle and the config loader. It is included in every kit that renders a UI. kitr adds `createApp` for the browser entry, `KitrProvider`, `KitrBoot` and the three hooks.

## Problems it solves

- **Singletons imported from everywhere.** Components ask `useService('http')` and tests swap the service. See [Read a service in your first component](/packages/react/guide#read-a-service-in-your-first-component).
- **Rendering before services exist.** `KitrBoot` waits for boot, or renders a fallback with Suspense. See [Boot before rendering](/packages/react/guide#boot-before-rendering).
- **Config values hard-coded in components.** `useConfig('theme')` returns the typed config file. See [Read config in a component](/packages/react/guide#read-config-in-a-component).
- **Your own services with no home.** Register them in a provider and read them with the same hook. See [Register your own service](/packages/react/guide#register-your-own-service).
- **Services needed outside components.** The app object is reachable from plain code. See [Reach the app outside components](/packages/react/guide#reach-the-app-outside-components).

## Further reading

- [Guide](/packages/react/guide): install, configure and every task.
- [API reference](/packages/react/api): every export with its signature.
- [React documentation](https://react.dev): Suspense, context and error boundaries.
- [Router](/packages/router) and [Testing](/packages/testing): pages inside the provider, and `createTestApp` with `renderWithKitr`.
- [Configuration](/docs/configuration): `kitrrc.ts`, `config/` and `app/env.ts`.
