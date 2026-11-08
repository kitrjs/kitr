import type { RouteEntry as TableEntry } from '@kitr/core'
import { type KitrApp, KitrError, validate } from '@kitr/core'
import type { KitrServer } from '@kitr/server'
import { H3, type H3Event } from 'h3'
import { createHttpContext } from './context'
import { isControllerRef, resolveControllerClass } from './controller'
import { compose, handlesPreflight } from './middleware'
import { httpEntries } from './routes'
import type { RouteEntry, Validators } from './types'

/**
 * Turn a kitr router into an h3 app. Mount it on a kitr server
 * (`server.mount('/', toH3(routes, server.app))`) or on any h3 instance.
 */
export function toH3(
  router: { entries: Array<{ kind: string }> } | RouteEntry[],
  app: KitrApp,
  options: { h3?: H3 } = {},
): H3 {
  const h3 = options.h3 ?? new H3()
  const routes = httpEntries(router as unknown as { entries: TableEntry[] })
  const preflight = new Map<string, RouteEntry>()
  const explicitOptions = new Set<string>()
  for (const route of routes) {
    h3.on(route.method, toRou3Path(route.path), (event) => dispatch(route, event, app))
    if (route.method === 'OPTIONS') explicitOptions.add(route.path)
    else if (!preflight.has(route.path) && route.middleware.some((m) => handlesPreflight in m))
      preflight.set(route.path, route)
  }
  // Browsers send OPTIONS before cross-origin writes; answer it with the route's middleware
  // (cors() replies 204) instead of a 404 that blocks the real request.
  for (const [path, route] of preflight) {
    if (explicitOptions.has(path)) continue
    h3.on('OPTIONS', toRou3Path(path), (event) =>
      dispatch({ ...route, method: 'OPTIONS', handler: () => null }, event, app),
    )
  }
  return h3
}

/** Mount a router on a kitr server. Returns the server for chaining. */
export function mountRoutes(
  server: KitrServer,
  router: { entries: Array<{ kind: string }> },
  base = '/',
): KitrServer {
  return server.mount(base, toH3(router, server.app))
}

/** Express/Adonis `:id` → h3/rou3 `:id` are the same; `*` → `**`. */
function toRou3Path(path: string): string {
  return path.replace(/\*$/, '**')
}

async function dispatch(route: RouteEntry, event: H3Event, app: KitrApp) {
  const ctx = await createHttpContext(event, app)
  const run = compose(route.middleware)
  return run(ctx, async () => {
    const handler = route.handler
    let validators: Validators | undefined = route.validate
    let fn: (ctx: any) => unknown
    if (isControllerRef(handler)) {
      const cls = await resolveControllerClass(handler[0] as any)
      // Built from the request's container: its services, its own instance.
      const instance = await ctx.app.container.make(cls)
      const method = (instance as any)[handler[1]]
      if (typeof method !== 'function')
        throw KitrError.notFound(`Controller method ${cls.name}.${handler[1]}`)
      validators ??= cls.validation?.[handler[1]]
      fn = (c) => method.call(instance, c)
    } else {
      fn = handler as (ctx: any) => unknown
    }
    if (validators) await applyValidators(ctx, validators)
    else if (['POST', 'PUT', 'PATCH'].includes(ctx.request.method))
      ctx.body = await ctx.request.raw()
    const result = await fn(ctx)
    if (result === undefined || result === null) {
      return new Response(null, { status: event.res.status ?? 204, headers: event.res.headers })
    }
    return result
  })
}

async function applyValidators(
  ctx: Awaited<ReturnType<typeof createHttpContext>>,
  validators: Validators,
) {
  const fieldErrors: Record<string, string[]> = {}
  const check = async (schema: Validators['body'], input: unknown, prefix: string) => {
    if (!schema) return input
    const result = await validate(schema, input)
    if (!result.success) {
      for (const [k, v] of Object.entries(result.fieldErrors))
        fieldErrors[prefix && k !== '_root' ? `${prefix}.${k}` : k] = v
      return input
    }
    return result.data
  }
  ctx.params = await check(validators.params, ctx.params, '')
  ctx.query = await check(validators.query, ctx.request.qs(), '')
  ctx.body = validators.body
    ? await check(validators.body, await ctx.request.raw(), '')
    : ['POST', 'PUT', 'PATCH'].includes(ctx.request.method)
      ? await ctx.request.raw()
      : undefined
  if (Object.keys(fieldErrors).length) throw KitrError.validation(fieldErrors)
}
