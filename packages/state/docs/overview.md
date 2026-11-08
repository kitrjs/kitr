---
title: Overview
description: Keep app-wide values like a cart or settings, and optionally save them in the browser.
order: 0
---

# State

Some values belong to the whole app rather than one component: the order someone is putting together before they submit it, whether the sidebar is open, which currency they prefer. Lifting them to the top of the tree means prop drilling; a global object means re-renders everywhere and nothing survives a reload.

`@kitr/state` gives you a small store for those values that any component can read and update, and that can remember them across reloads.

## What it is

`@kitr/state` is a store factory, `createKitrStore`, and the hooks it returns. You define the state and the actions that change it, components select the slice they need and re-render only when it changes, and plain code reads and writes the store outside React. Ask for persistence and the store saves itself to the browser, with versions so an old saved shape migrates instead of breaking.

It runs in the browser, and on the server while a page renders. For data a server owns, such as the list of orders or the signed-in user, use [query](/packages/query) instead.

## Built on

`@kitr/state` is [Zustand](https://zustand.docs.pmnd.rs), re-exported. `create`, selectors, middleware and everything in its docs work as written, imported from `@kitr/state`.

kitr adds one helper, `createKitrStore`, which makes a store safe for server rendering (no shared state between requests, no hydration mismatch), saves it in the browser through Zustand's [persist](https://zustand.docs.pmnd.rs/middlewares/persist) middleware when you ask, connects it to the Redux DevTools in development, and lets a page seed it from a loader.

## Problems it solves

- **Prop drilling app-wide values.** Any component reads the store with a selector. See [Read a value in a component](/packages/state/guide#read-a-value-in-a-component).
- **Re-renders on every change.** Components select only the values they use. See [Select several values at once](/packages/state/guide#select-several-values-at-once).
- **State lost on reload.** Persist the store in local or session storage. See [Save state in the browser](/packages/state/guide#save-state-in-the-browser).
- **Old saved data after a deploy.** Versions and a migrate function. See [Change the saved shape](/packages/state/guide#change-the-saved-shape).
- **Server rendering with a global store.** Each request gets its own store and the client hydrates it. See [Render on the server](/packages/state/guide#render-on-the-server).
- **Debugging state changes.** Every action shows in the Redux DevTools. See [Devtools](/packages/state/guide#devtools).

## Further reading

- [Guide](/packages/state/guide): install, configure and every task.
- [API reference](/packages/state/api): `createKitrStore` and its options.
- [Zustand docs](https://zustand.docs.pmnd.rs) and [persist options](https://zustand.docs.pmnd.rs/middlewares/persist): everything there works as written.
- [Query](/packages/query) and [Forms](/packages/forms): where server data and form state belong instead.
