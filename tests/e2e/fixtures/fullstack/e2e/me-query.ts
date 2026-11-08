import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

/** Per-user data under a fixed key: the case a shared server-side cache would leak. */
const whoami = createServerFn().handler(async () => {
  // Slow enough that concurrent requests overlap.
  await new Promise((r) => setTimeout(r, 50))
  return getCookie('who') ?? 'anonymous'
})

/** Shared by the `/e2e/me` page link's loader and the page component. */
export const meQuery = { queryKey: ['me'], queryFn: () => whoami(), staleTime: 60_000 }
