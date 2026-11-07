---
title: API
description: Every export of kitr/actions, with its signature.
order: 2
---

# API

Every export of `kitr/actions`, `kitr/actions/types`, read from the published type definitions. The [guide](/packages/actions) shows them in use.

## kitr/actions

Re-exports `@tanstack/start-client-core` unchanged, plus the following.

### defineMutation

```ts
function defineMutation<S extends StandardSchemaV1 | undefined = undefined, TOutput = unknown, TContext = {}>(name: string, options: DefineMutationOptions<S, TOutput, TContext>): ServerMutation<InputOf<S>, TOutput, TContext>;
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
function defineQuery<S extends StandardSchemaV1 | undefined = undefined, TOutput = unknown, TContext = {}>(name: string, options: DefineQueryOptions<S, TOutput, TContext>): ServerQuery<InputOf<S>, TOutput, TContext>;
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
interface DefineMutationOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext> extends DefineOperationOptions<S, TOutput, TContext> {
  /** Cache effects applied on the client after success. A function gets the result and the input. */
  effects?: CacheEffect | ((result: TOutput, input: InputOf<S>) => CacheEffect);
}
```

### DefineOperationOptions

```ts
interface DefineOperationOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext> {
  /** Any Standard Schema. Validated on the server; a failure reaches the caller as a VALIDATION error with field errors. */
  input?: S;
  /** TanStack Start function middleware (`createMiddleware({ type: 'function' })`). */
  middleware?: ReadonlyArray<any>;
  /** Runs on the server only. Its code, and anything it imports, never reaches the browser bundle. */
  handler: (ctx: HandlerContext<InputOf<S>, TContext>) => TOutput | Promise<TOutput>;
}
```

Options shared by `defineQuery` and `defineMutation`.

### DefineQueryOptions

```ts
interface DefineQueryOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext> extends DefineOperationOptions<S, TOutput, TContext> {
  /** How long a result counts as fresh, in milliseconds. Carried into the query options. */
  staleTime?: number;
}
```

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

### ServerMutation

```ts
interface ServerMutation<TInput, TOutput, TContext = unknown> extends MutationDefinition<TInput, TOutput> {
  (input: TInput, options?: {
    signal?: AbortSignal;
  }): Promise<TOutput>;
  readonly name: string;
  /** Validation and the handler in-process, for tests. Skips Start middleware. */
  run(input: TInput, options?: CallOptions<TContext>): Promise<TOutput>;
  readonly serverFn: ServerFn<TOutput>;
}
```

A server mutation: a `MutationDefinition` from `kitr/query` that is also a function. Call it to
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
  readonly serverFn: ServerFn<TOutput>;
}
```

A server query: a `QueryDefinition` from `kitr/query` that is also a function. Call it to fetch,
pass `.options(input)` to any TanStack hook or loader, or use it by name once `kitr types` has
registered it.

### ServerFn

```ts
type ServerFn<TOutput> = (opts: {
  data: unknown;
  signal?: AbortSignal;
}) => Promise<Envelope<TOutput>>;
```

The raw TanStack server function behind a definition, for `useServerFn` or middleware composition.

## kitr/actions/types

### renderActions

```ts
function renderActions(found: FoundOperation[], ctx: Pick<GenerateContext, 'importPath'>): string;
```

The generated module for a set of operations. Exported for tests and for `kitr doctor`.

### scanActions

```ts
function scanActions(file: string, source: string): FoundOperation[];
```

Every `export const <id> = defineQuery|defineMutation('<name>'` in one file.

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

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
