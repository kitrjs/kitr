import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

/** Per-user data under a fixed key: the case a shared server-side cache would leak. */
const whoami = createServerFn().handler(async () => {
  // Slow enough that concurrent requests overlap.
  await new Promise((r) => setTimeout(r, 50))
  return getCookie('who') ?? 'anonymous'
})
const meQuery = { queryKey: ['me'], queryFn: () => whoami(), staleTime: 60_000 }

export const Route = createFileRoute('/e2e/me')({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: Me,
})

function Me() {
  const { data } = useSuspenseQuery(meQuery)
  return <p data-testid="me">user:{data}</p>
}
