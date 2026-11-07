import { createFileRoute } from '@tanstack/react-router'
import { server } from '#server/main'

/** Every /api/* request goes to the kitr server (server/main.ts), in the Start process. */
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      ANY: ({ request }) => server.fetch(request),
    },
  },
})
