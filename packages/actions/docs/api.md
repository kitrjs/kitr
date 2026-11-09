---
title: API reference
description: Every export of @kitr/actions, with its signature.
order: 2
---

# API reference

Every export of `@kitr/actions`, `@kitr/actions/types`, `@kitr/actions/vite`, read from the published type definitions. The [guide](/packages/actions/guide) shows them in use.

## @kitr/actions

Re-exports `@tanstack/start-client-core` unchanged, plus the following.

### actionMiddleware

```ts
function actionMiddleware(action: {
  name: string;
  middleware: ReadonlyArray<unknown>;
}): never[];
```

The middleware for an action's server function, for the generated registry: the middleware the
action lists, behind kitr's guard, so an error any of them throws reaches the caller as the same
typed envelope a handler error does, masked in production.

### defineMutation

```ts
function defineMutation<S extends StandardSchemaV1 | undefined = undefined, TOutput = unknown, const M extends ReadonlyArray<unknown> = [
], TContext = MiddlewareContext<M>>(name: string, options: DefineMutationOptions<S, TOutput, TContext, M>): ServerMutation<InputOf<S>, TOutput, TContext>;
```

Define a mutation whose handler runs on the server, with the cache effects it has on success.

```ts
export const updateProject = defineMutation('projects.update', {
  input: z.object({ id: z.string(), name: z.string().min(2) }),
  effects: (project) => ({ set: [{ key: projectKeys.detail(project.id), data: project }], invalidate: [projectKeys.lists()] }),
  handler: ({ input }) => db.projects.update(input),
})
```

### defineQuery

```ts
function defineQuery<S extends StandardSchemaV1 | undefined = undefined, TOutput = unknown, const M extends ReadonlyArray<unknown> = [
], TContext = MiddlewareContext<M>>(name: string, options: DefineQueryOptions<S, TOutput, TContext, M>): ServerQuery<InputOf<S>, TOutput, TContext>;
```

Define a query whose handler runs on the server. The name is the registry key `kitr types`
writes to `.kitr/actions.ts`, so `useQuery('projects.list', input)` works with these types.

```ts
export const listProjects = defineQuery('projects.list', {
  input: z.object({ status: z.enum(['open', 'closed']).optional() }),
  handler: ({ input }) => db.projects.findMany({ where: input }),
})
```

### requireSession

```ts
const requireSession: import("@tanstack/react-start").FunctionMiddlewareAfterServer<{}, unknown, undefined, undefined, undefined, undefined, undefined>;
```

Shortcut: a function middleware that rejects anonymous callers. Expects `context.session` from an earlier middleware.

### CallOptions

```ts
interface CallOptions<TContext = unknown> {
  signal?: AbortSignal;
  /** `.run()` only: the middleware context the handler would see. */
  context?: Partial<TContext>;
}
```

Options for a direct call or `.run()`.

### DefineMutationOptions

```ts
interface DefineMutationOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext, M extends ReadonlyArray<unknown> = ReadonlyArray<unknown>> extends DefineOperationOptions<S, TOutput, TContext, M> {
  /** Cache effects applied on the client after success. A function gets the result and the input. */
  effects?: CacheEffect | ((result: TOutput, input: InputOf<S>) => CacheEffect);
}
```

The second argument of `defineMutation`: the shared options plus cache `effects`.

### DefineOperationOptions

```ts
interface DefineOperationOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext, M extends ReadonlyArray<unknown> = ReadonlyArray<unknown>> {
  /** Any Standard Schema. Validated on the server; a failure reaches the caller as a VALIDATION error with field errors. */
  input?: S;
  /**
   * TanStack Start function middleware (`createMiddleware({ type: 'function' })`). What each one
   * passes to `next({ context })` is typed on the handler's `context`. An error thrown here reaches
   * the caller the same way a handler error does, masked in production when it is a server error.
   */
  middleware?: M;
  /** Runs on the server only. Its code, and anything it imports, never reaches the browser bundle. */
  handler: (ctx: HandlerContext<InputOf<S>, TContext>) => TOutput | Promise<TOutput>;
}
```

Options shared by `defineQuery` and `defineMutation`.

### DefineQueryOptions

```ts
interface DefineQueryOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext, M extends ReadonlyArray<unknown> = ReadonlyArray<unknown>> extends DefineOperationOptions<S, TOutput, TContext, M> {
  /** How long a result counts as fresh, in milliseconds. Carried into the query options. */
  staleTime?: number;
}
```

The second argument of `defineQuery`: the shared options plus `staleTime`.

### HandlerContext

```ts
interface HandlerContext<TInput, TContext> {
  input: TInput;
  /** Context from Start middleware (request, session...). */
  context: TContext;
  signal: AbortSignal;
}
```

What a handler receives: the validated input, Start middleware context, and the request's abort signal.

### ServerFnContext

```ts
interface ServerFnContext<TContext = unknown> {
  data: unknown;
  context: TContext;
  signal: AbortSignal;
}
```

What a Start server function passes to its handler.

### ServerMutation

```ts
interface ServerMutation<TInput, TOutput, TContext = unknown> extends MutationDefinition<TInput, TOutput> {
  (input: TInput, options?: {
    signal?: AbortSignal;
  }): Promise<TOutput>;
  readonly name: string;
  /** Validation and the handler in-process, for tests. Skips Start middleware. */
  run(input: TInput, options?: CallOptions<TContext>): Promise<TOutput>;
  /** The Start server function behind this action, bound by the registry `kitr types` writes. */
  readonly serverFn: ServerFn<TOutput>;
  /** The middleware passed to `middleware`. The registry puts it on the server function. */
  readonly middleware: ReadonlyArray<unknown>;
  /** The server function's body: validate, run the handler and wrap the result. For the generated registry. */
  handle(ctx: ServerFnContext<TContext>): Promise<Envelope<TOutput>>;
  /** Attach the server function the registry created. For the generated registry. */
  bind(serverFn: ServerFn<TOutput>): void;
}
```

A server mutation: a `MutationDefinition` from `@kitr/query` that is also a function. Call it to
mutate, pass it to `useMutation` for pending state and cache effects, or use it by name.

### ServerQuery

```ts
interface ServerQuery<TInput, TOutput, TContext = unknown> extends QueryDefinition<TInput, TOutput> {
  (input: TInput, options?: {
    signal?: AbortSignal;
  }): Promise<TOutput>;
  readonly name: string;
  /** Validation and the handler in-process, for tests. Skips Start middleware. */
  run(input: TInput, options?: CallOptions<TContext>): Promise<TOutput>;
  /** The Start server function behind this action, bound by the registry `kitr types` writes. */
  readonly serverFn: ServerFn<TOutput>;
  /** The middleware passed to `middleware`. The registry puts it on the server function. */
  readonly middleware: ReadonlyArray<unknown>;
  /** The server function's body: validate, run the handler and wrap the result. For the generated registry. */
  handle(ctx: ServerFnContext<TContext>): Promise<Envelope<TOutput>>;
  /** Attach the server function the registry created. For the generated registry. */
  bind(serverFn: ServerFn<TOutput>): void;
}
```

A server query: a `QueryDefinition` from `@kitr/query` that is also a function. Call it to fetch,
pass `.options(input)` to any TanStack hook or loader, or use it by name once `kitr types` has
registered it.

### MiddlewareContext

```ts
type MiddlewareContext<M extends ReadonlyArray<unknown>> = [
  M[number]
] extends [
  never
] ? {} : UnionToIntersection<ServerContextOf<M[number]>> & {};
```

The context a list of Start function middleware gives the handler: every middleware's `next({ context })`, merged.

### ServerFn

```ts
type ServerFn<TOutput> = (opts: {
  data: unknown;
  signal?: AbortSignal;
}) => Promise<Envelope<TOutput>>;
```

The raw TanStack server function behind a definition, for `useServerFn` or middleware composition.

## @kitr/actions/types

### renderActions

```ts
function renderActions(found: FoundOperation[], ctx: Pick<GenerateContext, 'importPath'>): string;
```

The generated module for a set of operations. Exported for tests and for `kitr doctor`.

### scanActions

```ts
function scanActions(sources: Array<{
  file: string;
  source: string;
}>, options?: ScanOptions): Promise<FoundOperation[]>;
```

Every exported `defineQuery` / `defineMutation` call in the given sources, found with the
TypeScript compiler: the callee is resolved to its declaration, so an import alias
(`import { defineQuery as query }`), a namespace import (`k.defineQuery`) and a re-export
(`export { listProjects } from '../shared/projects'`) all count, and a local function that merely
shares the name does not. A name that is not a string literal is an error with `file:line`.

### FoundOperation

```ts
interface FoundOperation {
  /** Project-relative file. */
  file: string;
  /** The exported identifier. */
  exportName: string;
  /** The dotted name passed to `defineQuery` or `defineMutation`. */
  name: string;
  kind: 'query' | 'mutation';
}
```

The `actions` generator for `kitr types`. It reads every file under `app/actions`
(`directories.actions`), finds the exported `defineQuery` and `defineMutation` calls and writes
`.kitr/actions.ts`: the `operations` map `app/app.ts` passes to `createApp`, the same names as a
nested `actions` tree, and the `Operations` augmentation that types `useQuery('projects.list')`.

### ScanOptions

```ts
interface ScanOptions {
  /** The project root: where `tsconfig.json` is read from and module specifiers resolve. Default `/`. */
  root?: string;
  /** In-memory files by project-relative path (modules the actions import), seen before the file system. For tests. */
  files?: Record<string, string>;
}
```

## @kitr/actions/vite

### kitrActions

```ts
function kitrActions(): Plugin;
```

Keeps server code out of the browser. An action's `handler` runs on the server, but it is written
in a file the browser bundle imports for the action's name and schema, so without this its code
and every import it uses (the database client, secrets, `node:` modules) would ship to visitors.

### stripHandlers

```ts
function stripHandlers(code: string, parse: (code: string) => unknown): string | undefined;
```

Empty the `handler` of every `defineQuery` and `defineMutation` call in `code`, then drop the
imports nothing refers to any more. The calls themselves stay: the browser still needs each
action's name, input schema and cache effects. Returns `undefined` when there is nothing to strip.

`code` is JavaScript: run it after the TypeScript transform.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
