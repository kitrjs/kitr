---
title: Overview
description: Open a window that shows what every package is doing, from a floating button, a shortcut or a touch gesture. On in development; turn it on in production with one flag.
order: 0
---

# Devtools

## What it is

`@kitr/devtools` is a window in your app. It shows the route, the network requests, the query cache, the session, stored values, errors, analytics calls and one log every kitr package writes to. Open it from a floating button, a keyboard shortcut or a three-finger long press, on a laptop or on a phone. Your own providers can add panels.

Runs in the browser, in development. Set `enabled: true` in `config/devtools.ts` to use it in production too; otherwise production builds leave it out.

## Install

```sh
kitr add devtools
```

Adds `@kitr/devtools`, its provider and `config/devtools.ts`. [Every change](/packages/devtools/guide#install).

## Quick start

Run `kitr dev` and open the app. Tap the round button in the corner, press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd>, or hold three fingers on a touch screen, and the window opens. If that shortcut clashes with your browser, change it:

```ts
// config/devtools.ts
import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  position: 'bottom-right',
  shortcut: ['Meta', 'Alt', 'D'],
  maxEntries: 500,
  openByDefault: true,
})
```

The window now opens on <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Alt</kbd> + <kbd>D</kbd>, the button starts bottom-right and the window starts open. Next in the guide: [Open the panel](/packages/devtools/guide#open-the-panel), or [On a phone](/packages/devtools/guide#on-a-phone).

## Built on

It is a view onto kitr. Keep React Developer Tools and your browser's devtools next to it.

## Problems it solves

- **Guessing what the app is doing.** [Panels](/packages/devtools/guide#panels).
- **Debugging on a phone.** [On a phone](/packages/devtools/guide#on-a-phone).
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
