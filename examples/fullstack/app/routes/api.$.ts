import { createFileRoute } from '@tanstack/react-router'
import { server } from '#app/api/server'

/** Every /api/* request goes to the kitr router. */
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      ANY: ({ request }) => server.fetch(request),
    },
  },
})
