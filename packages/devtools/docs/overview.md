---
title: Overview
description: Open a panel in development that shows what every package is doing. It is removed from production builds.
order: 0
---

# Devtools

When a page shows stale data or a button does nothing, the first question is what the app is doing right now: which route matched, what is in the query cache, who is signed in, which request failed. Each library has its own devtools for its own slice, and none of them know about the others or about your services.

`@kitr/devtools` answers the question in the page itself, with one panel for every kitr package.

## What it is

In development a small "k" button sits in a corner of the app. Open it and a panel shows the current route, the query cache, the session, saved storage values, errors, analytics calls and one log that every kitr package writes to. A command palette runs actions you register. Your own providers add panels and log lines in a few lines of code.

It runs in the browser, in development only. It renders nothing on the server, binds nothing in production, and the `kitr()` Vite plugin leaves it out of production builds, so it adds no bytes for your users.

## Built on

`@kitr/devtools` is kitr's own, built on the devtools hub in the kitr core: every package that has something to show registers a panel, and every package that has something to say writes to the hub's log. The panel renders with React and [Hugeicons](https://hugeicons.com). It is a view onto kitr; for component trees and network timing, keep using [React Developer Tools](https://react.dev/learn/react-developer-tools) and your browser's devtools next to it, and the [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/devtools) and [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/devtools) devtools for deeper views of each library.

## Problems it solves

- **Guessing what the app is doing.** The Route, Query, Session, Storage and Errors panels show the live state of each package. See [Panels](/packages/devtools/guide#panels).
- **Logs scattered across packages.** Every kitr package writes to one log, with the package name and level on each line. See [Read the log](/packages/devtools/guide#read-the-log).
- **Your own code invisible in the panel.** The hub's `log()` and a panel made with `definePanel` put your services beside kitr's. See [Log from your code](/packages/devtools/guide#log-from-your-code) and [Add a panel](/packages/devtools/guide#add-a-panel).
- **Reproducing a state by clicking through the app.** Register an action and run it from the command palette: empty the cart, sign in as a test user, trigger an error. See [Run an action from the command palette](/packages/devtools/guide#run-an-action-from-the-command-palette).
- **Shipping debug tooling to users.** The package is removed from production builds by the Vite plugin, not by a runtime check. See [Install](/packages/devtools/guide#install).

## Further reading

- [Guide](/packages/devtools/guide): install, open the panel and extend it.
- [API reference](/packages/devtools/api): every export and type.
- [TanStack Router devtools](https://tanstack.com/router/latest/docs/framework/react/devtools) and [TanStack Query devtools](https://tanstack.com/query/latest/docs/framework/react/devtools): deeper views of each library.
- [Logger](/packages/logger), [Analytics](/packages/analytics) and [Monitoring](/packages/monitoring): the packages whose output lands in the panels.
- [Configuration](/docs/configuration): providers and `kitrrc.ts`, where panels are registered.
