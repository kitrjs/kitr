---
title: React
description: React with the kitr app in context, so every component can reach services and config.
order: 1
---

# React

`kitr/react` is what makes the kitr app available to components: `<KitrProvider app={app}>` at the root, then `useApp()`, `useService('http')` and `useConfig('query')` anywhere below it. Every package with a React side builds on it, so it is part of every UI app and you never add it by hand: `kitr add router` brings it in.

## What it gives you

- **`<KitrProvider>`**: boots the app once and provides it through context. Providers that implement `wrap()` (query, theme, auth, i18n) wrap your tree here, so you do not nest their providers yourself.
- **`useApp()`**: the app object, for the container, config, env and mode.
- **`useService(name)`**: a typed binding from the container, such as `useService('http')`.
- **`useConfig(name)`**: a package's config from `config/<name>.ts`.

```tsx
import { useService } from 'kitr/react'

function Projects() {
  const http = useService('http')
  // ...
}
```
