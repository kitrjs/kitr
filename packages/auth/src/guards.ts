import type { KitrApp } from '@kitr/core'

/**
 * `beforeLoad` step that makes `requireAuth()` and `can()` work in server-rendered routes: it
 * loads the session into the app in the route context before the guard reads it. During SSR the
 * session comes from the request being rendered (see `runWithSession` in `@kitr/auth/server`);
 * in the browser from the cookie-backed session endpoint, cached in the query client, so a
 * client-side navigation costs no request while the cache is fresh.
 *
 *   beforeLoad: async (ctx) => {
 *     await ensureSession(ctx)
 *     return requireAuth()(ctx)
 *   }
 */
export async function ensureSession(ctx: { context: { app: KitrApp } }): Promise<void> {
  const { app } = ctx.context
  await app.boot()
  if (!app.container.has('auth')) return
  const auth = app.container.use('auth')
  // A signed-in browser tab already holds its session; the server always reads the request's.
  if (app.isClient && auth.session.user) return
  await auth.load()
}
