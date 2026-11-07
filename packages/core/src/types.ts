/**
 * Hook for UI libraries to tell core what a "renderable node" is.
 * `@kitr/react` augments this with `{ node: ReactNode }`, so provider `wrap()`
 * is typed for React apps while core itself stays free of any React import.
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmentation target
export interface KitrNodeTypes {}

export type KitrNode = KitrNodeTypes extends { node: infer N } ? N : unknown

export type MaybePromise<T> = T | Promise<T>

export type Awaitable<T> = T | PromiseLike<T>

export type Prettify<T> = { [K in keyof T]: T[K] } & {}
