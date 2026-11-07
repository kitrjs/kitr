// Route table for the typed client. Regenerate with `kitr api:sync`.
export const routeTable = [
  {
    "name": "health",
    "method": "GET",
    "path": "/api/health"
  },
  {
    "name": "newsletter.subscribe",
    "method": "POST",
    "path": "/api/newsletter"
  }
] as const
