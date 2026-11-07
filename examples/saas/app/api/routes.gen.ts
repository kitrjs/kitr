// Route table for the typed client. Regenerate with `kitr api:sync`.
export const routeTable = [
  {
    "name": "health",
    "method": "GET",
    "path": "/api/health"
  },
  {
    "name": "auth.signIn",
    "method": "POST",
    "path": "/api/auth/sign-in"
  },
  {
    "name": "auth.signOut",
    "method": "POST",
    "path": "/api/auth/sign-out"
  },
  {
    "name": "auth.me",
    "method": "GET",
    "path": "/api/auth/me"
  },
  {
    "name": "projects.index",
    "method": "GET",
    "path": "/api/projects"
  },
  {
    "name": "projects.store",
    "method": "POST",
    "path": "/api/projects"
  },
  {
    "name": "projects.show",
    "method": "GET",
    "path": "/api/projects/:id"
  },
  {
    "name": "projects.update",
    "method": "PATCH",
    "path": "/api/projects/:id"
  },
  {
    "name": "projects.destroy",
    "method": "DELETE",
    "path": "/api/projects/:id"
  }
] as const
