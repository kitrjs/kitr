---
"@kitr/state": patch
---

A store read on the server outside its `StoreProvider` no longer throws "Store has no instance on the server". Each component that reads it gets a fresh store built from the initial state, dropped with the render, so a static build or an SSR page works without the provider and nothing leaks between requests. Wrap the tree in the provider to share one store per render, or pass `strict: true` to keep the error.
