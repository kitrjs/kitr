---
title: Overview
description: Open a panel in development that shows what every package is doing. It is removed from production builds.
order: 0
---

# Devtools

## What it is

`@kitr/devtools` is a panel in your app in development. It shows the route, the query cache, the session, stored values, errors, analytics calls and one log every kitr package writes to. Your own providers can add panels.

Runs in the browser, in development only. Production builds leave it out.

## Install

```sh
kitr add devtools
```

Adds `@kitr/devtools`, its provider and `config/devtools.ts`. [Every change](/packages/devtools/guide#install).

## Quick start

Run `kitr dev` and open the app. Click the "k" button in the corner, or press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd>, and the panel opens. If that shortcut clashes with your browser, change it:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  position: 'bottom-right',
  shortcutKey: 'j',
  maxEntries: 500,
  openByDefault: true,
})
```

The panel now opens on <kbd>Shift</kbd> + <kbd>J</kbd>, sits bottom-right and starts open. Next in the guide: [Open the panel](/packages/devtools/guide#open-the-panel).

## Built on

It is a view onto kitr. Keep React Developer Tools and your browser's devtools next to it.

## Problems it solves

- **Guessing what the app is doing.** [Panels](/packages/devtools/guide#panels).
- **Logs scattered across packages.** [Read the log](/packages/devtools/guide#read-the-log).
- **Your own code invisible in the panel.** [Log from your code](/packages/devtools/guide#log-from-your-code).
- **Reproducing a state by clicking through the app.** [Run an action from the command palette](/packages/devtools/guide#run-an-action-from-the-command-palette).
- **Shipping debug tooling to users.** [Install](/packages/devtools/guide#install).

## Further reading

- [Guide](/packages/devtools/guide).
- [API reference](/packages/devtools/api).
- [TanStack Router devtools](https://tanstack.com/router/latest/docs/framework/react/devtools) and [TanStack Query devtools](https://tanstack.com/query/latest/docs/framework/react/devtools).
- [Logger](/packages/logger), [Analytics](/packages/analytics) and [Monitoring](/packages/monitoring).
- [Configuration](/docs/configuration).
