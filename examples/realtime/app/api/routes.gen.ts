// Route table for the typed client. Regenerate with `kitr api:sync`.
export const routeTable = [
  {
    "name": "health",
    "method": "GET",
    "path": "/api/health"
  },
  {
    "name": "messages.index",
    "method": "GET",
    "path": "/api/messages"
  },
  {
    "name": "messages.store",
    "method": "POST",
    "path": "/api/messages"
  }
] as const
