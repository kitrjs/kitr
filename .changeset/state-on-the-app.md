---
"@kitr/core": minor
"@kitr/query": minor
"@kitr/offline": minor
"@kitr/actions": minor
"@kitr/seo": minor
"@kitr/router": minor
"@kitr/api": minor
"@kitr/cli": minor
"@kitr/server": minor
"@kitr/react": minor
"@kitr/kit-site": minor
---

State that was shared by the whole process now lives on the app.

- Operations: `createApp({ operations })` fills `app.operations`, and `app.fork()` gives a child registry that reads through to its parent. The process-wide `operations` export of `@kitr/core` (and `operations.reset()` in tests) is removed. `useQuery`, `useSuspenseQuery` and `useMutation` find the registry with `useApp()`; outside React, `queryOptions(context.app, 'projects.list', input)` and `call(app, 'projects.update', input)` take the app first, and `registerMutationDefaults(client, app.operations)` takes the registry.
- `kitr types` finds `defineQuery` and `defineMutation` with the TypeScript compiler instead of a regular expression: aliases, namespace imports and re-exports resolve by symbol, and a name that is not a string literal fails with `file:line`. `@kitr/actions` now has `typescript` as a peer dependency. The generated `.kitr/actions.ts` is unchanged.
- `kitr/seo`: the site defaults come from the app's `config/seo.ts`, not from module state. Pass the `head` argument as the second argument, `head: (ctx) => seo({ title }, ctx)`. `createKitrRouter` applies `seo.ssr` to its own router instead of writing it onto shared route objects.
- Controllers are built per request with `container.make(Controller)`, so constructors can take services (`static inject = ['db']`) and hold per-request state. `Container.make` accepts a class as well as a key.
- `loadRc(rc, config)` from `kitr/app` gives `createApp` and `createServer` the same options in `app/app.ts` and `server/main.ts`; the react and server templates use it.
- `kitr dev` with more than one platform prefixes every output line with the platform's name.
