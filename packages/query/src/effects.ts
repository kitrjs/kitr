import type { CacheEffect, QueryKey } from '@kitr/core'
import type { QueryClient } from '@tanstack/react-query'

/** Apply a cache effect from the data contract to a TanStack QueryClient. */
export async function applyCacheEffect(
  queryClient: QueryClient,
  effect: CacheEffect | void | undefined,
) {
  if (!effect) return
  for (const entry of effect.set ?? []) queryClient.setQueryData(entry.key as QueryKey, entry.data)
  for (const key of effect.remove ?? []) queryClient.removeQueries({ queryKey: key as QueryKey })
  await Promise.all(
    (effect.invalidate ?? []).map((key) =>
      queryClient.invalidateQueries({ queryKey: key as QueryKey }),
    ),
  )
}

/** Invalidate many keys at once. */
export function invalidate(queryClient: QueryClient, ...keys: QueryKey[]) {
  return Promise.all(
    keys.map((key) => queryClient.invalidateQueries({ queryKey: key as unknown[] })),
  )
}
